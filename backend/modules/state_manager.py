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

def get_summary_count(firewall_id, test_mode=False):
    prefix = "test_" if test_mode else ""
    summary_count_file = f".{prefix}summary_report_count_{firewall_id}"
    if not os.path.exists(summary_count_file):
        return 0
    try:
        with open(summary_count_file, 'r') as f:
            return int(f.read().strip())
    except (ValueError, FileNotFoundError):
        return 0

def save_summary_count(count, firewall_id, test_mode=False):
    prefix = "test_" if test_mode else ""
    summary_count_file = f".{prefix}summary_report_count_{firewall_id}"
    with open(summary_count_file, 'w') as f:
        f.write(str(count))

def get_final_summary_count(firewall_id, test_mode=False):
    prefix = "test_" if test_mode else ""
    final_summary_count_file = f".{prefix}final_summary_report_count_{firewall_id}"
    if not os.path.exists(final_summary_count_file):
        return 0
    try:
        with open(final_summary_count_file, 'r') as f:
            return int(f.read().strip())
    except (ValueError, FileNotFoundError):
        return 0

def save_final_summary_count(count, firewall_id, test_mode=False):
    prefix = "test_" if test_mode else ""
    final_summary_count_file = f".{prefix}final_summary_report_count_{firewall_id}"
    with open(final_summary_count_file, 'w') as f:
        f.write(str(count))

def reset_all_states(firewall_id, test_mode=True):
    """
    Utility function to clean up states, primarily for testing.
    """
    if not test_mode:
        # safety check
        return

    prefix = "test_"
    files_to_delete = [
        f".{prefix}last_run_timestamp_{firewall_id}",
        f".{prefix}last_cycle_run_{firewall_id}",
        f".{prefix}summary_report_count_{firewall_id}",
        f".{prefix}final_summary_report_count_{firewall_id}"
    ]
    for f in files_to_delete:
        if os.path.exists(f):
            os.remove(f)