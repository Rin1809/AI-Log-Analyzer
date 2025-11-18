import os
import glob
import json
import configparser
import logging
from datetime import datetime

from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, EmailStr
from typing import List, Dict, Any, Optional

import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from modules import state_manager

# --- config ---
CONFIG_FILE = "config.ini"
TEST_CONFIG_FILE = "test_assets/test_config.ini"
SYSTEM_SETTINGS_FILE = "system_settings.ini"
TEST_SYSTEM_SETTINGS_FILE = "system_settings_test.ini"

LOGGING_FORMAT = '%(asctime)s - %(levelname)s - %(message)s'
logging.basicConfig(level=logging.INFO, format=LOGGING_FORMAT)

app = FastAPI(
    title="AI-log-analyzer API",
    description="API để quản lý và giám sát tool phân tích log.",
    version="2.7.0", # // feat: Overhaul system settings
)

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
    return TEST_CONFIG_FILE if test_mode else CONFIG_FILE

def get_system_settings_path(test_mode: bool = False) -> str:
    return TEST_SYSTEM_SETTINGS_FILE if test_mode else SYSTEM_SETTINGS_FILE

def get_system_config_parser(test_mode: bool = False) -> configparser.ConfigParser:
    config_path = get_system_settings_path(test_mode)
    config = configparser.ConfigParser(interpolation=None, allow_no_value=True)
    
    if not os.path.exists(config_path):
        logging.warning(f"File system settings '{config_path}' khong ton tai. Tao file moi.")
        config.add_section('System')
        with open(config_path, 'w') as configfile:
            config.write(configfile)
    
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

class SmtpProfile(BaseModel):
    profile_name: str = Field(..., min_length=1)
    server: str = Field(..., min_length=1)
    port: int = Field(..., gt=0)
    sender_email: EmailStr
    sender_password: str

class SystemSettings(BaseModel):
    report_directory: Optional[str] = ''
    prompt_directory: Optional[str] = ''
    context_directory: Optional[str] = ''
    smtp_profiles: Dict[str, SmtpProfile] = {}
    active_smtp_profile: Optional[str] = None
    attach_context_files: bool = False
    scheduler_check_interval_seconds: int = 60


# --- API Endpoints ---
@app.get("/api/status", response_model=List[FirewallStatus])
async def get_firewall_status(test_mode: bool = False):
    try:
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
    try:
        config = configparser.ConfigParser(interpolation=None)
        config.read(get_active_config_file(test_mode))
        system_settings = get_system_config_parser(test_mode)
        
        report_dir = system_settings.get('System', 'report_directory', fallback='test_reports')
        
        if not os.path.isdir(report_dir): return []
        
        firewall_sections = [s for s in config.sections() if s.startswith('Firewall_')]
        hostname_map = {fw_id: config.get(fw_id, 'SysHostname', fallback=fw_id) for fw_id in firewall_sections}
        
        reports = []
        report_files = glob.glob(os.path.join(report_dir, 'Firewall_*', '**', '*.json'), recursive=True)
        report_files.sort(key=os.path.getmtime, reverse=True)
        
        for file_path in report_files:
            parts = file_path.split(os.sep)
            try:
                report_dir_base = os.path.basename(report_dir)
                firewall_id_from_path = parts[parts.index(report_dir_base) + 1]
            except (ValueError, IndexError):
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
    system_settings = get_system_config_parser(test_mode)
    report_dir = system_settings.get('System', 'report_directory', fallback='test_reports')
    
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
async def get_system_settings(test_mode: bool = False):
    try:
        config = get_system_config_parser(test_mode)
        settings = SystemSettings()

        if 'System' in config:
            system_sec = config['System']
            settings.report_directory = system_sec.get('report_directory', '')
            settings.prompt_directory = system_sec.get('prompt_directory', '')
            settings.context_directory = system_sec.get('context_directory', '')
            settings.active_smtp_profile = system_sec.get('active_smtp_profile')
            settings.attach_context_files = system_sec.getboolean('attach_context_files', False)
            settings.scheduler_check_interval_seconds = system_sec.getint('scheduler_check_interval_seconds', 60)

        profiles = {}
        for section_name in config.sections():
            if section_name.startswith('Email_'):
                profile_name = section_name[6:]
                profile_sec = config[section_name]
                profiles[profile_name] = SmtpProfile(
                    profile_name=profile_name,
                    server=profile_sec.get('server'),
                    port=profile_sec.getint('port'),
                    sender_email=profile_sec.get('sender_email'),
                    sender_password=profile_sec.get('sender_password', '')
                )
        settings.smtp_profiles = profiles
        return settings
    except Exception as e:
        logging.error(f"Error getting system settings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/system-settings", response_model=Dict[str, str])
async def update_system_settings(settings: SystemSettings, test_mode: bool = False):
    try:
        config_path = get_system_settings_path(test_mode)
        config = get_system_config_parser(test_mode)

        # // Xoa sach cac section email cu de ghi lai tu dau
        for section in config.sections():
            if section.startswith('Email_'):
                config.remove_section(section)

        if 'System' not in config:
            config.add_section('System')
        
        # // Ghi cac thong tin chung
        config.set('System', 'report_directory', settings.report_directory or '')
        config.set('System', 'prompt_directory', settings.prompt_directory or '')
        config.set('System', 'context_directory', settings.context_directory or '')
        config.set('System', 'active_smtp_profile', settings.active_smtp_profile or '')
        config.set('System', 'attach_context_files', str(settings.attach_context_files))
        config.set('System', 'scheduler_check_interval_seconds', str(settings.scheduler_check_interval_seconds))

        # // Ghi lai cac profile email
        for name, profile in settings.smtp_profiles.items():
            section_name = f'Email_{name}'
            config.add_section(section_name)
            config.set(section_name, 'server', profile.server)
            config.set(section_name, 'port', str(profile.port))
            config.set(section_name, 'sender_email', profile.sender_email)
            config.set(section_name, 'sender_password', profile.sender_password)

        with open(config_path, 'w') as configfile:
            config.write(configfile)
            
        return {"status": "success", "message": "System settings updated successfully."}
    except Exception as e:
        logging.error(f"Error updating system settings: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to save settings: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="127.0.0.1", port=8000, reload=True)
