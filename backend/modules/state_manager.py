import os
from datetime import datetime

def get_last_run_timestamp(firewall_id, test_mode=False):
    prefix = "test_" if test_mode else ""
    state_file = f".{prefix}last_run_timestamp_{firewall_id}"
    if os.path.exists(state_file):
        with open(state_file, 'r') as f:
            try:
                return datetime.fromisoformat(f.read().strip())
            except ValueError:
                return None
    return None

def save_last_run_timestamp(timestamp, firewall_id, test_mode=False):
    prefix = "test_" if test_mode else ""
    state_file = f".{prefix}last_run_timestamp_{firewall_id}"
    with open(state_file, 'w') as f:
        f.write(timestamp.isoformat())

def get_last_cycle_run_timestamp(firewall_id, test_mode=False):
    prefix = "test_" if test_mode else ""
    state_file = f".{prefix}last_cycle_run_{firewall_id}"
    if os.path.exists(state_file):
        with open(state_file, 'r') as f:
            try:
                return datetime.fromisoformat(f.read().strip())
            except ValueError:
                return None
    return None

def save_last_cycle_run_timestamp(timestamp, firewall_id, test_mode=False):
    prefix = "test_" if test_mode else ""
    state_file = f".{prefix}last_cycle_run_{firewall_id}"
    with open(state_file, 'w') as f:
        f.write(timestamp.isoformat())

# --- Generic Stage Buffer Counters ---

def get_stage_buffer_count(firewall_id, stage_index, test_mode=False):
    """Lay so luong bao cao dang cho (buffer) cho stage cu the."""
    prefix = "test_" if test_mode else ""
    # file name convention: .buffer_count_{firewall}_{stage_index}
    count_file = f".{prefix}buffer_count_{firewall_id}_{stage_index}"
    if not os.path.exists(count_file):
        return 0
    try:
        with open(count_file, 'r') as f:
            return int(f.read().strip())
    except (ValueError, FileNotFoundError):
        return 0

def save_stage_buffer_count(firewall_id, stage_index, count, test_mode=False):
    """Luu so luong buffer."""
    prefix = "test_" if test_mode else ""
    count_file = f".{prefix}buffer_count_{firewall_id}_{stage_index}"
    with open(count_file, 'w') as f:
        f.write(str(count))

def reset_all_states(firewall_id, test_mode=True):
    """
    Cleanup states. Also cleans up dynamic stage buffers.
    """
    if not test_mode: return

    prefix = "test_"
    # Clean basic states
    files_to_delete = [
        f".{prefix}last_run_timestamp_{firewall_id}",
        f".{prefix}last_cycle_run_{firewall_id}",
    ]
    
    # Clean dynamic buffer files
    for f in os.listdir('.'):
        if f.startswith(f".{prefix}buffer_count_{firewall_id}"):
            files_to_delete.append(f)

    for f in files_to_delete:
        if os.path.exists(f):
            os.remove(f)