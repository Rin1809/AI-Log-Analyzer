
import os
import json
import logging
import pytz
import re
from datetime import datetime

def slugify(text):
    """Tao slug safe cho ten thu muc."""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '_', text)
    return text

def save_structured_report(host_id, report_data, timezone_str, base_report_dir, stage_name):
    """Luu du lieu tho ra file JSON, folder dua theo stage_name."""
    try:
        tz = pytz.timezone(timezone_str)
        now = datetime.now(tz)
        
        date_folder = now.strftime('%Y-%m-%d')
        time_filename = now.strftime('%H-%M-%S') + '.json'
        
        # Folder thi dung slug cho an toan
        safe_stage_name = slugify(stage_name)
        
        host_specific_dir = os.path.join(base_report_dir, host_id)
        report_folder_path = os.path.join(host_specific_dir, safe_stage_name, date_folder)

        os.makedirs(report_folder_path, exist_ok=True)
        
        report_file_path = os.path.join(report_folder_path, time_filename)


        report_data['report_type'] = stage_name

        with open(report_file_path, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, ensure_ascii=False, indent=4)
            
        logging.info(f"[{host_id}] Da luu bao cao JSON ({stage_name}) vao: '{report_file_path}'")
        return report_file_path
    except Exception as e:
        logging.error(f"[{host_id}] Loi khi luu file JSON: {e}")
        return None
