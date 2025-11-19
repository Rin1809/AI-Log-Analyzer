import os
import shutil
from datetime import datetime

# Dinh nghia duong dan luu state
MAIN_STATE_DIR = os.path.join('states', 'main')
TEST_STATE_DIR = os.path.join('states', 'test')

def _get_state_file_path(filename, test_mode=False):
    """
    Helper de lay duong dan file state.
    Tu dong tao thu muc neu chua ton tai.
    """
    directory = TEST_STATE_DIR if test_mode else MAIN_STATE_DIR
    
    if not os.path.exists(directory):
        os.makedirs(directory, exist_ok=True)
        
    return os.path.join(directory, filename)

def get_last_run_timestamp(host_id, test_mode=False):
    file_path = _get_state_file_path(f"last_run_timestamp_{host_id}", test_mode)
    if os.path.exists(file_path):
        with open(file_path, 'r') as f:
            try:
                return datetime.fromisoformat(f.read().strip())
            except ValueError:
                return None
    return None

def save_last_run_timestamp(timestamp, host_id, test_mode=False):
    file_path = _get_state_file_path(f"last_run_timestamp_{host_id}", test_mode)
    with open(file_path, 'w') as f:
        f.write(timestamp.isoformat())

def get_last_cycle_run_timestamp(host_id, test_mode=False):
    file_path = _get_state_file_path(f"last_cycle_run_{host_id}", test_mode)
    if os.path.exists(file_path):
        with open(file_path, 'r') as f:
            try:
                return datetime.fromisoformat(f.read().strip())
            except ValueError:
                return None
    return None

def save_last_cycle_run_timestamp(timestamp, host_id, test_mode=False):
    file_path = _get_state_file_path(f"last_cycle_run_{host_id}", test_mode)
    with open(file_path, 'w') as f:
        f.write(timestamp.isoformat())

def get_stage_buffer_count(host_id, stage_index, test_mode=False):
    """Lay so luong bao cao dang cho (buffer) cho stage cu the."""
    file_path = _get_state_file_path(f"buffer_count_{host_id}_{stage_index}", test_mode)
    if not os.path.exists(file_path):
        return 0
    try:
        with open(file_path, 'r') as f:
            return int(f.read().strip())
    except (ValueError, FileNotFoundError):
        return 0

def save_stage_buffer_count(host_id, stage_index, count, test_mode=False):
    """Luu so luong buffer."""
    file_path = _get_state_file_path(f"buffer_count_{host_id}_{stage_index}", test_mode)
    with open(file_path, 'w') as f:
        f.write(str(count))

def reset_all_states(host_id, test_mode=True):
    """
    Cleanup states. Chi xoa trong thu muc test tuong ung.
    """
    if not test_mode: return

    target_dir = TEST_STATE_DIR
    if not os.path.exists(target_dir): return

    for filename in os.listdir(target_dir):
        if host_id in filename:
            file_path = os.path.join(target_dir, filename)
            try:
                os.remove(file_path)
            except OSError:
                pass