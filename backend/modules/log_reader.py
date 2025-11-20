
import logging
import pytz
from datetime import datetime, timedelta
from modules import state_manager

# // gioi han so dong log doc mot lan de tranh tran RAM
MAX_LOG_LINES_PER_RUN = 10000 

def read_new_log_entries(file_path, hours, timezone_str, host_id, test_mode=False):
    """
    Doc cac dong log moi tu mot file log cu the.
    QUAN TRONG: Ham nay KHONG luu state. No tra ve timestamp moi nhat de caller quyet dinh luu.
    Returns: (content, start_time, end_time, log_count, new_latest_timestamp)
    """
    logging.info(f"[{host_id}] Bat dau doc log tu '{file_path}'.")
    try:
        tz = pytz.timezone(timezone_str)
        end_time = datetime.now(tz) # day la thoi diem quet hien tai

        if test_mode:
            logging.info(f"[{host_id}] TEST MODE: Doc toan bo file log '{file_path}'.")
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                all_entries = f.readlines()
            
            # // gia lap thoi gian cho test mode
            start_time = end_time - timedelta(days=30)
            
            if len(all_entries) > MAX_LOG_LINES_PER_RUN:
                 all_entries = all_entries[-MAX_LOG_LINES_PER_RUN:]
            
            log_count = len(all_entries)
            logging.info(f"[{host_id}] Tim thay {log_count} dong log (Test Mode).")
            # // Test mode thi tra ve luon end_time lam new timestamp
            return ("".join(all_entries), start_time, end_time, log_count, end_time)

        # // PRODUCTION MODE
        last_run_time = state_manager.get_last_run_timestamp(host_id, test_mode)

        if last_run_time:
            start_time = last_run_time.astimezone(tz)
            logging.info(f"[{host_id}] Doc log ke tu lan chay cuoi: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        else:
            start_time = end_time - timedelta(hours=hours)
            logging.info(f"[{host_id}] Lan chay dau tien. Doc log trong vong {hours} gio qua.")

        new_entries = []
        # // khoi tao mac dinh neu khong co log nao moi thi pointer van tien len hien tai
        latest_log_time = start_time 
        current_year = end_time.year
        
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
                        # // cap nhat con tro thoi gian neu tim thay log moi hon
                        if log_datetime_aware > latest_log_time:
                            latest_log_time = log_datetime_aware
                except ValueError:
                    continue

        # // Safety Check: chong tran bo nho
        if len(new_entries) > MAX_LOG_LINES_PER_RUN:
            logging.warning(f"[{host_id}] Log volume qua lon ({len(new_entries)}). Chi lay {MAX_LOG_LINES_PER_RUN} dong cuoi cung.")
            new_entries = new_entries[-MAX_LOG_LINES_PER_RUN:]
            new_entries.insert(0, f"!!! WARNING: So luong log vuot qua gioi han. Chi phan tich {MAX_LOG_LINES_PER_RUN} dong moi nhat. !!!\n")

        # // Chu y: o day khong save state nua. Viec do la cua main.py sau khi confirm success.
        
        log_count = len(new_entries)
        # // Neu khong co log moi, ta van phai update timestamp len end_time de lan sau khong quet lai vung trong nay
        if log_count == 0:
            latest_log_time = end_time

        logging.info(f"[{host_id}] Tim thay {log_count} dong log moi.")
        return ("".join(new_entries), start_time, end_time, log_count, latest_log_time)

    except FileNotFoundError:
        logging.error(f"[{host_id}] Loi: Khong tim thay file log tai '{file_path}'.")
        return (None, None, None, 0, None)
    except Exception as e:
        logging.error(f"[{host_id}] Loi khong mong muon khi doc file: {e}")
        return (None, None, None, 0, None)
