import os
import json
import logging
from datetime import datetime
from modules import utils

# --- CAU HINH DUONG DAN TUYET DOI ---
# Lay duong dan thu muc chua file nay: .../backend/modules
CURRENT_MODULE_DIR = os.path.dirname(os.path.abspath(__file__))
# Di nguoc len 1 cap de lay root backend: .../backend
BACKEND_DIR = os.path.dirname(CURRENT_MODULE_DIR)

# Dinh nghia duong dan state luon nam trong backend/states
MAIN_STATE_DIR = os.path.join(BACKEND_DIR, 'states', 'main')
TEST_STATE_DIR = os.path.join(BACKEND_DIR, 'states', 'test')

def _get_state_file_path(filename, test_mode=False):
    """
    Helper de lay duong dan file state tuyet doi.
    Tu dong tao thu muc neu chua ton tai.
    """
    directory = TEST_STATE_DIR if test_mode else MAIN_STATE_DIR
    
    if not os.path.exists(directory):
        try:
            os.makedirs(directory, exist_ok=True)
        except OSError as e:
            logging.error(f"Khong the tao thu muc state {directory}: {e}")
        
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

def increment_api_usage(key_alias="Unknown", test_mode=False):
    """
    Tang so dem API call, luu chi tiet theo key_alias.
    Thread-safe & Process-safe bang file lock.
    """
    file_path = _get_state_file_path("api_usage_stats.json", test_mode)
    
    try:
        with utils.file_lock(file_path):
            data = {"total": 0, "breakdown": {}}
            
            # Read existing
            if os.path.exists(file_path):
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read().strip()
                        if content:
                            data = json.loads(content)
                except (json.JSONDecodeError, ValueError):
                    # File loi thi ghi de luon, ko can log nhieu
                    pass
            
            # Ensure structure
            if "total" not in data: data["total"] = 0
            if "breakdown" not in data: data["breakdown"] = {}
            
            # Update
            data["total"] += 1
            current_alias_count = data["breakdown"].get(key_alias, 0)
            data["breakdown"][key_alias] = current_alias_count + 1
            
            # Write back atomic-ish
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                f.flush()
                os.fsync(f.fileno())
                
    except Exception as e:
        logging.error(f"Error updating API usage stats: {e}")

def get_api_usage_stats(test_mode=False):
    """
    Lay thong tin thong ke API usage.
    """
    file_path = _get_state_file_path("api_usage_stats.json", test_mode)
    legacy_path = _get_state_file_path("api_usage_counter.txt", test_mode)
    
    legacy_count = 0
    # Fallback doc file txt cu
    if os.path.exists(legacy_path):
        try:
            with open(legacy_path, 'r') as f: legacy_count = int(f.read().strip())
        except: pass

    data = {"total": 0, "breakdown": {}}
    
    # Neu chua co file json, tra ve legacy
    if not os.path.exists(file_path):
        if legacy_count > 0:
             return {"total": legacy_count, "breakdown": { "Legacy Data": legacy_count }}
        return data

    try:
        # Them lock de tranh doc file rong khi dang ghi
        with utils.file_lock(file_path):
            if os.path.exists(file_path):
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read().strip()
                    if content:
                        data = json.loads(content)
            
        return data
        
    except Exception as e:
        logging.error(f"Error reading API stats: {e}")
        return {"total": legacy_count, "breakdown": {}}

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