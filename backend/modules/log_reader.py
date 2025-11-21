import logging
import pytz
import os
from datetime import datetime, timedelta
from modules import state_manager

# // Gioi han so dong log mac dinh xu ly mot lan
DEFAULT_MAX_LOG_LINES = 10000 

def try_parse_timestamp_flexible(line, current_year, tz):

    line = line.strip()
    if not line: return None


    if len(line) >= 15:
        try:
            if line[3] == ' ':
                date_part = line[:15]
                if date_part[4] == ' ': 
                    date_part = date_part[:4] + '0' + date_part[5:]
                
                dt_naive = datetime.strptime(f"{current_year} {date_part}", "%Y %b %d %H:%M:%S")
                return tz.localize(dt_naive)
        except ValueError:
            pass


    if len(line) >= 19:
        try:
            date_part = line[:19].replace('T', ' ')
            if date_part[0] == '2' and date_part[1] == '0':
                dt_naive = datetime.strptime(date_part, "%Y-%m-%d %H:%M:%S")
                return tz.localize(dt_naive)
        except ValueError:
            pass

    return None

def read_new_log_entries(file_path, hours, timezone_str, host_id, test_mode=False, custom_limit=None):
    """
    Doc log moi. Ho tro custom_limit de doc nhieu hon khi chay song song.
    """
    limit_to_use = custom_limit if custom_limit else DEFAULT_MAX_LOG_LINES
    
    logging.info(f"[{host_id}] Bat dau doc log tu '{file_path}' (Limit: {limit_to_use}).")
    try:
        tz = pytz.timezone(timezone_str)
        end_time = datetime.now(tz) 
        current_year = end_time.year

        if test_mode:
            logging.info(f"[{host_id}] TEST MODE: Doc toan bo file log.")
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                all_entries = f.readlines()
            start_time = end_time - timedelta(days=30) 
            
            if len(all_entries) > limit_to_use:
                 all_entries = all_entries[-limit_to_use:] 
            return ("".join(all_entries), start_time, end_time, len(all_entries), end_time)

        # // PRODUCTION MODE LOGIC
        last_run_time = state_manager.get_last_run_timestamp(host_id, test_mode)

        if last_run_time:
            start_time = last_run_time.astimezone(tz)
            logging.info(f"[{host_id}] Doc log ke tu: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        else:
            start_time = end_time - timedelta(hours=hours)
            logging.info(f"[{host_id}] Lan chay dau tien. Doc log {hours}h qua.")

        new_entries = []
        
        last_valid_timestamp = start_time
        
        try:
            file_mtime = datetime.fromtimestamp(os.path.getmtime(file_path), tz=tz)
            if file_mtime > start_time:
                fallback_timestamp = file_mtime
            else:
                fallback_timestamp = end_time
        except:
            fallback_timestamp = end_time

        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                parsed_time = try_parse_timestamp_flexible(line, current_year, tz)
                
                if parsed_time:
                    if parsed_time > end_time + timedelta(days=1):
                         parsed_time = parsed_time.replace(year=current_year - 1)
                    current_log_time = parsed_time
                    last_valid_timestamp = parsed_time
                else:
                    current_log_time = last_valid_timestamp if last_valid_timestamp > start_time else fallback_timestamp

                # // So sanh voi moc thoi gian lan chay truoc
                if current_log_time > start_time:
                    # // Luu tuple (timestamp, line) de sort va loc sau
                    new_entries.append((current_log_time, line))

        new_entries.sort(key=lambda x: x[0])

        total_found = len(new_entries)
        if total_found > limit_to_use:
            logging.warning(f"[{host_id}] Log volume qua lon ({total_found}). Chi xu ly {limit_to_use} dong DAU TIEN.")
            new_entries = new_entries[:limit_to_use]
            
            # // Canh bao AI
            final_lines = [x[1] for x in new_entries]
            final_lines.append(f"\n!!! WARNING: Con {total_found - limit_to_use} dong log nua chua xu ly trong dot nay. !!!\n")
            
            # // Timestamp moi la thoi gian cua dong log cuoi cung duoc lay
            new_latest_timestamp = new_entries[-1][0]
        else:
            final_lines = [x[1] for x in new_entries]
            if new_entries:
                new_latest_timestamp = new_entries[-1][0]
            else:
                # // Khong co log moi -> day timestamp len hien tai
                new_latest_timestamp = end_time

        log_count = len(final_lines)
        logging.info(f"[{host_id}] Da loc duoc {log_count} dong log phu hop.")
        
        return ("".join(final_lines), start_time, end_time, log_count, new_latest_timestamp)

    except FileNotFoundError:
        logging.error(f"[{host_id}] Loi: Khong tim thay file log '{file_path}'.")
        return (None, None, None, 0, None)
    except Exception as e:
        logging.error(f"[{host_id}] Loi khong mong muon: {e}")
        return (None, None, None, 0, None)