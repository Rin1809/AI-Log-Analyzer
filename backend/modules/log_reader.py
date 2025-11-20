import logging
import pytz
from datetime import datetime, timedelta
from modules import state_manager

# // gioi han so dong log doc mot lan de tranh tran RAM
MAX_LOG_LINES_PER_RUN = 10000 

def read_new_log_entries(file_path, hours, timezone_str, host_id, test_mode=False):
    """Doc cac dong log moi tu mot file log cu the, tra ve noi dung va so luong dong."""
    logging.info(f"[{host_id}] Bat dau doc log tu '{file_path}'.")
    try:
        tz = pytz.timezone(timezone_str)

        if test_mode:
            logging.info(f"[{host_id}] TEST MODE: Doc toan bo file log '{file_path}'.")
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                all_entries = f.readlines()
            
            end_time = datetime.now(tz)
            start_time = end_time - timedelta(days=30)
            
            # // cat bot neu test file qua lon
            if len(all_entries) > MAX_LOG_LINES_PER_RUN:
                 all_entries = all_entries[-MAX_LOG_LINES_PER_RUN:]
            
            log_count = len(all_entries)
            logging.info(f"[{host_id}] Tim thay {log_count} dong log (Test Mode).")
            return ("".join(all_entries), start_time, end_time, log_count)

        end_time = datetime.now(tz)
        last_run_time = state_manager.get_last_run_timestamp(host_id, test_mode)

        if last_run_time:
            start_time = last_run_time.astimezone(tz)
            logging.info(f"[{host_id}] Doc log ke tu lan chay cuoi: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        else:
            start_time = end_time - timedelta(hours=hours)
            logging.info(f"[{host_id}] Lan chay dau tien. Doc log trong vong {hours} gio qua.")

        new_entries = []
        latest_log_time = start_time
        current_year = end_time.year
        
        # // doc file stream line-by-line de tiet kiem ram
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                try:
                    # // format log pfsense: "Mmm dd hh:mm:ss"
                    line_date_str = line[:6] + line[7:15] if line[6] != ' ' else line[:15]
                    
                    log_time_str = line_date_str
                    log_datetime_naive = datetime.strptime(f"{current_year} {log_time_str}", "%Y %b %d %H:%M:%S")
                    log_datetime_aware = tz.localize(log_datetime_naive)
                    
                    # // xu ly truong hop qua nam moi
                    if log_datetime_aware > end_time:
                        log_datetime_aware = log_datetime_aware.replace(year=current_year - 1)
                        
                    if log_datetime_aware > start_time:
                        new_entries.append(line)
                        if log_datetime_aware > latest_log_time:
                            latest_log_time = log_datetime_aware
                except ValueError:
                    continue

        # // Safety Check: chong tran bo nho
        if len(new_entries) > MAX_LOG_LINES_PER_RUN:
            logging.warning(f"[{host_id}] Log volume qua lon ({len(new_entries)}). Chi lay {MAX_LOG_LINES_PER_RUN} dong cuoi cung.")
            new_entries = new_entries[-MAX_LOG_LINES_PER_RUN:]
            # // them canh bao vao dau de AI biet
            new_entries.insert(0, f"!!! WARNING: So luong log vuot qua gioi han. Chi phan tich {MAX_LOG_LINES_PER_RUN} dong moi nhat. !!!\n")

        if new_entries:
            state_manager.save_last_run_timestamp(latest_log_time, host_id, test_mode)
        
        log_count = len(new_entries)
        logging.info(f"[{host_id}] Tim thay {log_count} dong log moi.")
        return ("".join(new_entries), start_time, end_time, log_count)

    except FileNotFoundError:
        logging.error(f"[{host_id}] Loi: Khong tim thay file log tai '{file_path}'.")
        return (None, None, None, 0)
    except Exception as e:
        logging.error(f"[{host_id}] Loi khong mong muon khi doc file: {e}")
        return (None, None, None, 0)