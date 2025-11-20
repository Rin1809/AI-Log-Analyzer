import pytest
import os
from unittest.mock import patch, MagicMock
from modules.gemini_analyzer import analyze_with_gemini
from modules.log_reader import read_new_log_entries, MAX_LOG_LINES_PER_RUN
from google.api_core import exceptions as google_exceptions

def test_gemini_infinite_retry_prevention(tmp_path): # <--- Thêm tmp_path
    """
    Đảm bảo hệ thống không retry vô tận gây treo tiến trình nếu Google sập hẳn.
    """
    # Tạo file prompt giả để vượt qua bước check file
    dummpy_prompt = tmp_path / "prompt.md"
    dummpy_prompt.write_text("Dummy prompt content")
    
    with patch('google.generativeai.GenerativeModel') as MockModel:
        mock_instance = MockModel.return_value
        # Side effect: Luôn ném lỗi 503 Service Unavailable
        mock_instance.generate_content.side_effect = google_exceptions.ServiceUnavailable("Down")
        
        with patch('time.sleep'): # Skip sleep time
            # Truyền đường dẫn file prompt giả vào
            result = analyze_with_gemini("HostX", "Log", "", "Key", str(dummpy_prompt), "model")
            
        # Expect: Phải trả về chuỗi lỗi gracefully
        assert "Lỗi mạng hoặc Rate Limit" in result
        assert mock_instance.generate_content.call_count <= 4

def test_log_reader_memory_limit(temp_test_env):
    """
    Tạo file log giả lập 100MB (hoặc số dòng cực lớn) để test giới hạn đọc.
    """
    huge_log_path = os.path.join(temp_test_env['root'], "huge.log")
    
    # Tạo file có số dòng gấp đôi giới hạn cho phép
    limit = MAX_LOG_LINES_PER_RUN
    total_lines = limit * 2 + 500
    
    with open(huge_log_path, 'w') as f:
        for i in range(total_lines):
            f.write(f"Oct 10 10:00:00 pfsense filterlog: Line {i}\n")
            
    content, _, _, count = read_new_log_entries(huge_log_path, 24, "UTC", "HostTest", test_mode=True)
    
    lines = content.splitlines()
    # Trừ đi dòng warning ở đầu
    actual_log_lines = [l for l in lines if "WARNING" not in l]
    
    assert len(actual_log_lines) <= limit
    assert f"Line {total_lines-1}" in content, "Phải chứa dòng log mới nhất"
    assert "Line 0" not in content, "Không được chứa dòng log cũ quá giới hạn"