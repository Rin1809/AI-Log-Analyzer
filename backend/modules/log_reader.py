import logging
import pytz
from datetime import datetime, timedelta
from modules import state_manager

def read_new_log_entries(file_path, hours, timezone_str, firewall_id, test_mode=False):
    """Doc cac dong log moi tu mot file log cu the."""
    logging.info(f"[{firewall_id}] Bat dau doc log tu '{file_path}'.")
    try:
        tz = pytz.timezone(timezone_str)

        # // fix: khi test, doc toan bo file log de dam bao co data
        if test_mode:
            logging.info(f"[{firewall_id}] TEST MODE: Doc toan bo file log '{file_path}'.")
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                all_entries = f.readlines()
            
            end_time = datetime.now(tz)
            # // set start_time ve mot moc xa de bao gom tat ca log trong report
            start_time = end_time - timedelta(days=30)
            
            logging.info(f"[{firewall_id}] Tim thay {len(all_entries)} dong log moi.")
            return ("".join(all_entries), start_time, end_time)

        end_time = datetime.now(tz)
        last_run_time = state_manager.get_last_run_timestamp(firewall_id, test_mode)

        if last_run_time:
            start_time = last_run_time.astimezone(tz)
            logging.info(f"[{firewall_id}] Doc log ke tu lan chay cuoi: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        else:
            start_time = end_time - timedelta(hours=hours)
            logging.info(f"[{firewall_id}] Lan chay dau tien. Doc log trong vong {hours} gio qua.")

        new_entries = []
        latest_log_time = start_time
        current_year = end_time.year
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                try:
                    # quick fix: handle logs with date format like 'Oct 17' instead of 'Oct  7'
                    line_date_str = line[:6] + line[7:15] if line[6] != ' ' else line[:15]
                    
                    log_time_str = line_date_str
                    log_datetime_naive = datetime.strptime(f"{current_year} {log_time_str}", "%Y %b %d %H:%M:%S")
                    log_datetime_aware = tz.localize(log_datetime_naive)
                    if log_datetime_aware > end_time:
                        log_datetime_aware = log_datetime_aware.replace(year=current_year - 1)
                    if log_datetime_aware > start_time:
                        new_entries.append(line)
                        if log_datetime_aware > latest_log_time:
                            latest_log_time = log_datetime_aware
                except ValueError:
                    continue

        if new_entries:
            state_manager.save_last_run_timestamp(latest_log_time, firewall_id, test_mode)

        logging.info(f"[{firewall_id}] Tim thay {len(new_entries)} dong log moi.")
        return ("".join(new_entries), start_time, end_time)

    except FileNotFoundError:
        logging.error(f"[{firewall_id}] Loi: Khong tim thay file log tai '{file_path}'.")
        return (None, None, None)
    except Exception as e:
        logging.error(f"[{firewall_id}] Loi khong mong muon khi doc file: {e}")
        return (None, None, None)