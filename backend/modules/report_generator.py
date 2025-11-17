import os
import json
import logging
import pytz
from datetime import datetime

def save_structured_report(firewall_id, report_data, timezone_str, base_report_dir, report_level='periodic'):
    """Luu du lieu tho ra file JSON, co to chuc theo thu muc cap do va firewall_id."""
    try:
        tz = pytz.timezone(timezone_str)
        now = datetime.now(tz)
        
        date_folder = now.strftime('%Y-%m-%d')
        time_filename = now.strftime('%H-%M-%S') + '.json'
        
        # // path moi: base_dir/firewall_id/level/date/file.json
        # // logic nay dam bao moi host co thu muc rieng
        host_specific_dir = os.path.join(base_report_dir, firewall_id)

        if report_level == 'final':
            report_folder_path = os.path.join(host_specific_dir, "final", date_folder)
        elif report_level == 'summary':
            report_folder_path = os.path.join(host_specific_dir, "summary", date_folder)
        else: # periodic
             report_folder_path = os.path.join(host_specific_dir, "periodic", date_folder)

        os.makedirs(report_folder_path, exist_ok=True)
        
        report_file_path = os.path.join(report_folder_path, time_filename)

        with open(report_file_path, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, ensure_ascii=False, indent=4)
        logging.info(f"[{firewall_id}] Da luu bao cao JSON ({report_level}) vao: '{report_file_path}'")
        return report_file_path # Tra ve duong dan de su dung trong test
    except Exception as e:
        logging.error(f"[{firewall_id}] Loi khi luu file JSON: {e}")
        return None