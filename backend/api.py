import os
import glob
import json
import configparser
import logging
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any

# // tam fix: import module tu thu muc cha
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from modules import state_manager

# --- config ---
CONFIG_FILE = "config.ini"
LOGGING_FORMAT = '%(asctime)s - %(levelname)s - %(message)s'
logging.basicConfig(level=logging.INFO, format=LOGGING_FORMAT)

app = FastAPI(
    title="pfsense-log-analyzer API",
    description="API để quản lý và giám sát tool phân tích log pfSense.",
    version="1.0.0",
)

# // @todo: config CORS chặt hơn cho production
origins = [
    "http://localhost",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_config():
    """Doc va tra ve config parser object."""
    config = configparser.ConfigParser(interpolation=None)
    if not os.path.exists(CONFIG_FILE):
        raise HTTPException(status_code=500, detail=f"Config file not found: {CONFIG_FILE}")
    config.read(CONFIG_FILE)
    return config

# --- Pydantic Models ---
class FirewallStatus(BaseModel):
    id: str
    hostname: str
    status: str
    last_run: str | None
    
class ReportInfo(BaseModel):
    filename: str
    path: str
    type: str # 'periodic', 'summary', 'final'
    generated_time: str

# --- API Endpoints ---
@app.get("/api/status", response_model=List[FirewallStatus])
async def get_firewall_status():
    """
    Lay trang thai cua tat ca cac firewall duoc cau hinh.
    """
    try:
        config = get_config()
        firewall_sections = [s for s in config.sections() if s.startswith('Firewall_')]
        status_list = []

        for section in firewall_sections:
            last_run_ts = state_manager.get_last_cycle_run_timestamp(section)
            status_list.append(
                FirewallStatus(
                    id=section,
                    hostname=config.get(section, 'SysHostname', fallback='N/A'),
                    status="Online", # // logic don gian, neu doc dc config la online
                    last_run=last_run_ts.isoformat() if last_run_ts else "Never"
                )
            )
        return status_list
    except Exception as e:
        logging.error(f"Error getting firewall status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/reports", response_model=List[ReportInfo])
async def get_all_reports():
    """
    Quet va tra ve danh sach tat ca cac file report da duoc tao.
    """
    try:
        config = get_config()
        # // gia dinh report dir giong nhau cho moi firewall, lay cai dau tien
        report_dir = config.get(config.sections()[0], 'ReportDirectory', fallback='test_reports')

        if not os.path.isdir(report_dir):
            return [] # tra ve list rong neu thu muc ko ton tai

        reports = []
        # glob pattern to find all json files in the directory structure
        report_files = glob.glob(os.path.join(report_dir, '**', '*.json'), recursive=True)
        
        # sap xep file moi nhat len dau
        report_files.sort(key=os.path.getmtime, reverse=True)

        for file_path in report_files:
            report_type = 'periodic'
            if 'summary' in file_path:
                report_type = 'summary'
            if 'final' in file_path:
                report_type = 'final'
            
            gen_time = datetime.fromtimestamp(os.path.getmtime(file_path))

            reports.append(ReportInfo(
                filename=os.path.basename(file_path),
                path=file_path,
                type=report_type,
                generated_time=gen_time.strftime('%Y-%m-%d %H:%M:%S')
            ))
        return reports
    except Exception as e:
        logging.error(f"Error getting reports: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/report-content", response_model=Dict[str, Any])
async def get_report_content(path: str):
    """
    Doc va tra ve noi dung cua mot file report JSON.
    """
    # // Defensive coding: kiem tra path de tranh traversal attack
    config = get_config()
    report_dir = config.get(config.sections()[0], 'ReportDirectory', fallback='test_reports')
    safe_base_dir = os.path.abspath(report_dir)
    requested_path = os.path.abspath(path)

    if not requested_path.startswith(safe_base_dir):
        raise HTTPException(status_code=403, detail="Access denied: Invalid path.")

    if not os.path.exists(requested_path):
        raise HTTPException(status_code=404, detail="Report file not found.")

    try:
        with open(requested_path, 'r', encoding='utf-8') as f:
            content = json.load(f)
        return content
    except Exception as e:
        logging.error(f"Error reading report content from {path}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Could not read or parse report file: {e}")

if __name__ == "__main__":
    import uvicorn
    # // Chay server, --reload de tu dong update khi code thay doi
    uvicorn.run("api:app", host="127.0.0.1", port=8000, reload=True)