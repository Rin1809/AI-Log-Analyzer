import os
import glob
import json
import configparser
import logging
from datetime import datetime

from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from modules import state_manager

# --- config ---
CONFIG_FILE = "config.ini"
TEST_CONFIG_FILE = "test_assets/test_config.ini"
LOGGING_FORMAT = '%(asctime)s - %(levelname)s - %(message)s'
logging.basicConfig(level=logging.INFO, format=LOGGING_FORMAT)

app = FastAPI(
    title="AI-log-analyzer API",
    description="API để quản lý và giám sát tool phân tích log.",
    version="2.4.0", # // version bump for settings feature
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

def get_active_config_file(test_mode: bool) -> str:
    """Tra ve duong dan file config active (prod hoac test)."""
    return TEST_CONFIG_FILE if test_mode else CONFIG_FILE

def get_config_parser(test_mode: bool = False) -> configparser.ConfigParser:
    """Doc va tra ve config parser object tu file config tuong ung."""
    # // Luon doc config chinh (config.ini) cho system settings
    config_path = CONFIG_FILE
    config = configparser.ConfigParser(interpolation=None)
    if not os.path.exists(config_path):
        raise HTTPException(status_code=500, detail=f"Config file not found: {config_path}")
    config.read(config_path)
    return config

# --- Pydantic Models ---
class FirewallStatus(BaseModel):
    id: str
    hostname: str
    status: str
    is_enabled: bool
    last_run: str | None
    
class ReportInfo(BaseModel):
    filename: str
    path: str
    hostname: str
    type: str 
    generated_time: str
    summary_stats: Dict[str, Any] | None = None

class ConfigUpdateRequest(BaseModel):
    content: str

class SystemSettings(BaseModel):
    ReportDirectory: Optional[str] = Field(None, alias='reportdirectory')
    PromptDirectory: Optional[str] = Field(None, alias='promptdirectory')
    ContextDirectory: Optional[str] = Field(None, alias='contextdirectory')

    class Config:
        allow_population_by_field_name = True


# --- API Endpoints ---
@app.get("/api/status", response_model=List[FirewallStatus])
async def get_firewall_status(test_mode: bool = False):
    """Lay trang thai cua tat ca cac firewall duoc cau hinh."""
    try:
        # // phai doc dung file config test/prod cho status
        config = configparser.ConfigParser(interpolation=None)
        config.read(get_active_config_file(test_mode))

        firewall_sections = [s for s in config.sections() if s.startswith('Firewall_')]
        status_list = []

        for section in firewall_sections:
            last_run_ts = state_manager.get_last_cycle_run_timestamp(section, test_mode)
            is_enabled = config.getboolean(section, 'enabled', fallback=True)
            status_list.append(
                FirewallStatus(
                    id=section,
                    hostname=config.get(section, 'SysHostname', fallback='N/A'),
                    status="Online" if is_enabled else "Disabled",
                    is_enabled=is_enabled,
                    last_run=last_run_ts.isoformat() if last_run_ts else "Never"
                )
            )
        return status_list
    except Exception as e:
        logging.error(f"Error getting firewall status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/status/{firewall_id}/toggle", response_model=Dict[str, Any])
async def toggle_firewall_status(firewall_id: str, test_mode: bool = False):
    """Bat/tat mot firewall host."""
    config_path = get_active_config_file(test_mode)
    config = configparser.ConfigParser(interpolation=None)
    config.read(config_path)

    if firewall_id not in config:
        raise HTTPException(status_code=404, detail="Firewall ID not found")

    try:
        current_state = config.getboolean(firewall_id, 'enabled', fallback=True)
        config.set(firewall_id, 'enabled', str(not current_state))
        
        with open(config_path, 'w') as configfile:
            config.write(configfile)
        
        return {"id": firewall_id, "new_status": "enabled" if not current_state else "disabled"}
    except Exception as e:
        logging.error(f"Error toggling status for {firewall_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to update config file: {e}")


@app.get("/api/reports", response_model=List[ReportInfo])
async def get_all_reports(test_mode: bool = False):
    """Quet, tra ve danh sach report va nhung luon summary_stats vao response."""
    try:
        config = configparser.ConfigParser(interpolation=None)
        config.read(get_active_config_file(test_mode))

        firewall_sections = [s for s in config.sections() if s.startswith('Firewall_')]
        if not firewall_sections: return []
        
        report_dir = config.get(firewall_sections[0], 'ReportDirectory', fallback='test_reports')
        if not os.path.isdir(report_dir): return []

        reports = []
        report_files = glob.glob(os.path.join(report_dir, 'Firewall_*', '**', '*.json'), recursive=True)
        report_files.sort(key=os.path.getmtime, reverse=True)
        hostname_map = {fw_id: config.get(fw_id, 'SysHostname', fallback=fw_id) for fw_id in firewall_sections}

        for file_path in report_files:
            parts = file_path.split(os.sep)
            # // logic nay co the sai neu ten report_dir co os.sep
            try:
                report_dir_base = os.path.basename(report_dir)
                firewall_id_from_path = parts[parts.index(report_dir_base) + 1]
            except (ValueError, IndexError):
                # // fallback, neu ten folder khong giong config
                firewall_id_from_path = "Unknown_Host"


            report_type = 'periodic'
            if 'summary' in file_path: report_type = 'summary'
            if 'final' in file_path: report_type = 'final'
            
            gen_time = datetime.fromtimestamp(os.path.getmtime(file_path))

            report_summary_stats = None
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    report_content = json.load(f)
                    report_summary_stats = report_content.get('summary_stats', {})
                    report_summary_stats['raw_log_count'] = report_content.get('raw_log_count', 0)

            except (json.JSONDecodeError, KeyError, FileNotFoundError) as e:
                logging.warning(f"Could not read or parse stats from {file_path}: {e}")
                
            reports.append(ReportInfo(
                filename=os.path.basename(file_path),
                path=file_path,
                hostname=hostname_map.get(firewall_id_from_path, 'Unknown'),
                type=report_type,
                generated_time=gen_time.strftime('%Y-%m-%d %H:%M:%S'),
                summary_stats=report_summary_stats
            ))
        return reports
    except Exception as e:
        logging.error(f"Error getting reports: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/config/{firewall_id}", response_model=Dict[str, str])
async def get_firewall_config(firewall_id: str, test_mode: bool = False):
    """Lay noi dung config cua mot firewall."""
    config_path = get_active_config_file(test_mode)
    config = configparser.ConfigParser(interpolation=None)
    config.read(config_path)

    if firewall_id not in config:
        raise HTTPException(status_code=404, detail="Firewall ID not found")
    
    config_items = dict(config.items(firewall_id))
    config_content = f"[{firewall_id}]\n"
    for key, value in config_items.items():
        config_content += f"{key} = {value}\n"
        
    return {"content": config_content}

@app.post("/api/config/{firewall_id}", response_model=Dict[str, str])
async def update_firewall_config(firewall_id: str, request: ConfigUpdateRequest, test_mode: bool = False):
    """Cap nhat config cho mot firewall. Ten section se duoc giu nguyen."""
    config_path = get_active_config_file(test_mode)
    config = configparser.ConfigParser(interpolation=None)
    config.read(config_path)
    if firewall_id not in config:
        raise HTTPException(status_code=404, detail="Firewall ID not found")
    
    try:
        temp_parser = configparser.ConfigParser(interpolation=None)
        temp_parser.read_string(request.content)

        if not temp_parser.sections():
            raise configparser.ParsingError("No section found in submitted content")

        temp_section_name = temp_parser.sections()[0]
        
        for key, value in temp_parser.items(temp_section_name):
            config.set(firewall_id, key, value)
            
        with open(config_path, 'w') as configfile:
            config.write(configfile)
            
        return {"status": "success", "message": f"Config for {firewall_id} updated."}
    except Exception as e:
        logging.error(f"Error updating config for {firewall_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to parse or save config: {e}")


@app.get("/api/report-content", response_model=Dict[str, Any])
async def get_report_content(path: str, test_mode: bool = False):
    """Doc va tra ve noi dung cua mot file report JSON."""
    config_path = get_active_config_file(test_mode)
    config = configparser.ConfigParser(interpolation=None)
    config.read(config_path)
    firewall_sections = [s for s in config.sections() if s.startswith('Firewall_')]
    if not firewall_sections:
        raise HTTPException(status_code=500, detail="No firewalls configured.")

    report_dir = config.get(firewall_sections[0], 'ReportDirectory', fallback='test_reports')
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

@app.get("/api/system-settings", response_model=SystemSettings)
async def get_system_settings():
    """Lay cac cau hinh chung tu section [System] cua file config.ini."""
    try:
        config = get_config_parser() # luon dung config.ini
        if 'System' not in config:
            return SystemSettings() # tra ve object rong neu ko co section
        
        settings_data = {key: value for key, value in config.items('System')}
        return SystemSettings(**settings_data)
    except Exception as e:
        logging.error(f"Error getting system settings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/system-settings", response_model=Dict[str, str])
async def update_system_settings(settings: SystemSettings):
    """Cap nhat cau hinh trong section [System] cua config.ini."""
    try:
        config_path = CONFIG_FILE
        config = get_config_parser()
        if 'System' not in config:
            config.add_section('System')
        
        update_data = settings.model_dump(by_alias=True, exclude_unset=True)
        for key, value in update_data.items():
            config.set('System', key, str(value))
            
        with open(config_path, 'w') as configfile:
            config.write(configfile)
            
        return {"status": "success", "message": "System settings updated."}
    except Exception as e:
        logging.error(f"Error updating system settings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to save settings: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="127.0.0.1", port=8000, reload=True)