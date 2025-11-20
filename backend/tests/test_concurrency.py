import pytest
import threading
import time
import configparser
from modules.utils import file_lock

def write_config_safely(file_path, thread_id):
    """Hàm mô phỏng việc ghi config của 1 thread."""
    try:
        with file_lock(file_path):
            # Đọc, sửa, ghi (Critical Section)
            conf = configparser.ConfigParser()
            conf.read(file_path)
            if 'Counter' not in conf:
                conf.add_section('Counter')
            
            # Tăng biến đếm
            current = int(conf.get('Counter', 'value', fallback=0))
            conf.set('Counter', 'value', str(current + 1))
            
            # Giả lập độ trễ để tăng khả năng xảy ra xung đột
            time.sleep(0.01) 
            
            with open(file_path, 'w') as f:
                conf.write(f)
        return True
    except TimeoutError:
        return False

def test_race_condition_on_config_file(temp_test_env):
    """
    STRESS TEST: Cho 50 threads cùng đập vào 1 file config qua file_lock.
    Expect: Giá trị cuối cùng phải bằng đúng 50. Nếu < 50 => Mất dữ liệu (Race Condition).
    """
    config_path = temp_test_env['config_file']
    
    # Init file
    with open(config_path, 'w') as f:
        f.write("[Counter]\nvalue=0")

    threads = []
    success_count = 0
    
    # Khởi tạo 50 threads
    for i in range(50):
        t = threading.Thread(target=write_config_safely, args=(config_path, i))
        threads.append(t)
        t.start()

    for t in threads:
        t.join()

    # Verify kết quả
    conf = configparser.ConfigParser()
    conf.read(config_path)
    final_value = int(conf.get('Counter', 'value'))
    
    print(f"\nExpected: 50, Actual: {final_value}")
    assert final_value == 50, "Race condition detected! File lock mechanism failed."