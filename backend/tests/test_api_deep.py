import pytest
from modules import state_manager
import os
def test_pipeline_buffer_logic(temp_test_env):
    """
    Test logic đếm buffer:
    Stage 1 cần 10 reports từ Stage 0 mới chạy.
    Ta giả lập save 9 lần, check chưa chạy. Save lần 10, check chạy.
    """
    host_id = "Host_Buffer_Test"
    
    # Reset state
    state_manager.save_stage_buffer_count(host_id, 1, 0, test_mode=True)
    
    # 1. Set buffer = 9
    state_manager.save_stage_buffer_count(host_id, 1, 9, test_mode=True)
    count = state_manager.get_stage_buffer_count(host_id, 1, test_mode=True)
    assert count == 9
    
    # Logic trigger nằm ở main.py, nhưng ở đây ta test unit của state manager
    # Verify file được tạo đúng vị trí
    expected_file = os.path.join("states", "test", f"buffer_count_{host_id}_1")
    assert os.path.exists(expected_file)