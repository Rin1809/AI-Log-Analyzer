
import pytest
import os
from datetime import datetime
from unittest.mock import patch, MagicMock
from modules.gemini_analyzer import analyze_with_gemini
from modules.log_reader import read_new_log_entries, MAX_LOG_LINES_PER_RUN
from modules import state_manager
from google.api_core import exceptions as google_exceptions
# Import hàm run_pipeline_stage_0 để test integration logic
from main import run_pipeline_stage_0

def test_gemini_infinite_retry_prevention(tmp_path): 
    """
    Đảm bảo hệ thống không retry vô tận gây treo tiến trình nếu Google sập hẳn.
    """
    dummpy_prompt = tmp_path / "prompt.md"
    dummpy_prompt.write_text("Dummy prompt content")
    
    with patch('google.generativeai.GenerativeModel') as MockModel:
        mock_instance = MockModel.return_value
        mock_instance.generate_content.side_effect = google_exceptions.ServiceUnavailable("Down")
        
        with patch('time.sleep'): 
            result = analyze_with_gemini("HostX", "Log", "", "Key", str(dummpy_prompt), "model")
            
        assert "Lỗi mạng hoặc Rate Limit" in result
        assert mock_instance.generate_content.call_count <= 4

def test_log_reader_memory_limit(temp_test_env):
    """
    Tạo file log giả lập 100MB để test giới hạn đọc.
    """
    huge_log_path = os.path.join(temp_test_env['root'], "huge.log")
    limit = MAX_LOG_LINES_PER_RUN
    total_lines = limit * 2 + 500
    
    with open(huge_log_path, 'w') as f:
        for i in range(total_lines):
            f.write(f"Oct 10 10:00:00 pfsense filterlog: Line {i}\n")
            
    # Update: read_new_log_entries tra ve 5 gia tri
    content, _, _, count, _ = read_new_log_entries(huge_log_path, 24, "UTC", "HostTest", test_mode=True)
    
    lines = content.splitlines()
    actual_log_lines = [l for l in lines if "WARNING" not in l]
    
    assert len(actual_log_lines) <= limit
    assert f"Line {total_lines-1}" in content

def test_data_integrity_on_ai_failure(temp_test_env):
    """
    CRITICAL: Test Transactional Logic.
    Nếu AI Analysis thất bại, timestamp KHÔNG được cập nhật vào state file.
    Lần chạy sau phải quét lại đúng đoạn log đó.
    """
    host_id = "Host_Integrity_Test"
    log_file = os.path.join(temp_test_env['root'], "test.log")
    
    # 1. Tạo log giả
    with open(log_file, 'w') as f:
        f.write("2025 Jan 01 10:00:00 pfsense filterlog: critical packet\n")

    # 2. Mock Config object
    mock_config = MagicMock()
    mock_config.get.side_effect = lambda section, key, fallback=None: {
        'LogFile': log_file,
        'SysHostname': 'TestHost',
        'TimeZone': 'UTC'
    }.get(key, fallback)
    mock_config.getint.return_value = 24

    mock_sys_settings = MagicMock()
    mock_sys_settings.get.return_value = str(temp_test_env['report_dir'])

    # 3. Mock log_reader để trả về dữ liệu như thật
    # Return: (content, start, end, count, NEW_TIMESTAMP)
    mock_read_return = ("log content", datetime.now(), datetime.now(), 1, datetime(2025, 12, 31))
    
    with patch('modules.log_reader.read_new_log_entries', return_value=mock_read_return):
        # 4. Mock Gemini failure
        with patch('modules.gemini_analyzer.analyze_with_gemini', return_value="Fatal Gemini Error"):
            
            # 5. Run Pipeline
            success = run_pipeline_stage_0(mock_config, host_id, {}, "key", mock_sys_settings, test_mode=True)
            
            # Assert Pipeline bao fail
            assert success is False
            
            # 6. Assert State File KHÔNG tồn tại hoặc KHÔNG cập nhật
            # Vì đây là lần chạy đầu tiên trong env test, file không nên được tạo ra
            state_path = state_manager._get_state_file_path(f"last_run_timestamp_{host_id}", test_mode=True)
            assert not os.path.exists(state_path), "State file should not be created on failure"

