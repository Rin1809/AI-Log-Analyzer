import os
import glob
import json
import configparser
import logging
import shutil
from datetime import datetime

from fastapi import FastAPI, HTTPException, Body, UploadFile, File, Form
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
MODEL_LIST_FILE = "model_list.ini"

LOGGING_FORMAT = '%(asctime)s - %(levelname)s - %(message)s'
logging.basicConfig(level=logging.INFO, format=LOGGING_FORMAT)

app = FastAPI(
    title="AI-log-analyzer API",
    description="API để quản lý và giám sát tool phân tích log.",
    version="3.0.1", # // fix: Handle empty context_directory path on upload
)

origins = ["http://localhost", "http://localhost:3000"]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

def get_active_config_file(test_mode: bool) -> str:
    return TEST_CONFIG_FILE if test_mode else CONFIG_FILE

def get_system_settings_path(test_mode: bool = False) -> str:
    return TEST_SYSTEM_SETTINGS_FILE if test_mode else SYSTEM_SETTINGS_FILE

def get_system_config_parser(test_mode: bool = False) -> configparser.ConfigParser:
    config_path = get_system_settings_path(test_mode)
    config = configparser.ConfigParser(interpolation=None, allow_no_value=True)
    
    # // fix: tu dong tao file settings neu khong ton tai
    if not os.path.exists(config_path):
        logging.warning(f"File system settings '{config_path}' khong ton tai. Tao file moi voi cau truc mac dinh.")
        config.add_section('System')
        config.set('System', 'report_directory', 'reports' if not test_mode else 'test_reports')
        config.set('System', 'prompt_directory', 'prompts')
        config.set('System', 'context_directory', 'Bonus_context')
        config.set('System', 'scheduler_check_interval_seconds', '60')
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
    last_run: Optional[str] = None

class ReportInfo(BaseModel):
    filename: str
    path: str
    hostname: str
    type: str
    generated_time: str
    summary_stats: Optional[Dict[str, Any]] = None

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
    
class HostConfig(BaseModel):
    syshostname: str = Field(..., min_length=1)
    logfile: str
    run_interval_seconds: int
    hourstoanalyze: int
    timezone: str
    recipientemails: str
    geminiapikey: str
    gemini_model: str
    summary_enabled: bool
    reports_per_summary: int
    summary_recipient_emails: str
    summary_gemini_model: str
    final_summary_enabled: bool
    summaries_per_final_report: int
    final_summary_recipient_emails: str
    final_summary_model: str
    networkdiagram: str
    context_files: List[str] = []

# --- Helper Functions ---
def get_firewall_id(hostname: str) -> str:
    return f"Firewall_{hostname.replace(' ', '_')}"

def config_to_dict(config: configparser.ConfigParser, section: str) -> dict:
    if not config.has_section(section):
        return {}
    
    config_dict = dict(config.items(section))

    standard_keys = [
        'syshostname', 'logfile', 'hourstoanalyze', 'timezone', 'reportdirectory',
        'recipientemails', 'run_interval_seconds', 'geminiapikey', 'networkdiagram',
        'enabled', 'summary_enabled', 'reports_per_summary', 'summary_recipient_emails',
        'prompt_file', 'summary_prompt_file', 'final_summary_enabled',
        'summaries_per_final_report', 'final_summary_recipient_emails',
        'final_summary_prompt_file', 'gemini_model', 'summary_gemini_model', 'final_summary_model'
    ]
    context_keys = [key for key in config.options(section) if key not in standard_keys]
    config_dict['context_files'] = [config.get(section, key) for key in context_keys]

    for key, value in config_dict.items():
        if key in ['run_interval_seconds', 'hourstoanalyze', 'reports_per_summary', 'summaries_per_final_report']:
            config_dict[key] = int(value)
        elif key in ['summary_enabled', 'final_summary_enabled']:
            config_dict[key] = config.getboolean(section, key)
            
    return config_dict

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
            status_list.append(FirewallStatus(
                id=section,
                hostname=config.get(section, 'SysHostname', fallback='N/A'),
                status="Online" if is_enabled else "Disabled",
                is_enabled=is_enabled,
                last_run=last_run_ts.isoformat() if last_run_ts else "Never"
            ))
        return status_list
    except Exception as e:
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
        raise HTTPException(status_code=500, detail=f"Failed to update config file: {e}")

# --- HOST CRUD ENDPOINTS ---
@app.get("/api/hosts/{firewall_id}", response_model=Dict)
async def get_host_details(firewall_id: str, test_mode: bool = False):
    config = configparser.ConfigParser(interpolation=None)
    config.read(get_active_config_file(test_mode))
    if not config.has_section(firewall_id):
        raise HTTPException(status_code=404, detail="Host not found")
    return config_to_dict(config, firewall_id)

@app.post("/api/hosts", response_model=Dict)
async def create_host(host_config: HostConfig, test_mode: bool = False):
    firewall_id = get_firewall_id(host_config.syshostname)
    config_path = get_active_config_file(test_mode)
    config = configparser.ConfigParser(interpolation=None)
    config.read(config_path)
    if config.has_section(firewall_id):
        raise HTTPException(status_code=409, detail=f"Host with name '{host_config.syshostname}' already exists.")
    config.add_section(firewall_id)
    for key, value in host_config.model_dump(exclude={'context_files'}).items():
        config.set(firewall_id, key, str(value))
    for i, file_path in enumerate(host_config.context_files, 1):
        config.set(firewall_id, f'context_file_{i}', file_path)
    config.set(firewall_id, 'enabled', 'True')
    with open(config_path, 'w') as configfile:
        config.write(configfile)
    return {"status": "success", "message": f"Host {host_config.syshostname} created."}

@app.put("/api/hosts/{firewall_id}", response_model=Dict)
async def update_host(firewall_id: str, host_config: HostConfig, test_mode: bool = False):
    config_path = get_active_config_file(test_mode)
    config = configparser.ConfigParser(interpolation=None)
    config.read(config_path)
    if not config.has_section(firewall_id):
        raise HTTPException(status_code=404, detail="Host not found")
    standard_keys = [
        'syshostname', 'logfile', 'hourstoanalyze', 'timezone', 'reportdirectory',
        'recipientemails', 'run_interval_seconds', 'geminiapikey', 'networkdiagram',
        'enabled', 'summary_enabled', 'reports_per_summary', 'summary_recipient_emails',
        'prompt_file', 'summary_prompt_file', 'final_summary_enabled',
        'summaries_per_final_report', 'final_summary_recipient_emails',
        'final_summary_prompt_file', 'gemini_model', 'summary_gemini_model', 'final_summary_model'
    ]
    for option in config.options(firewall_id):
        if option not in standard_keys:
            config.remove_option(firewall_id, option)
    for key, value in host_config.model_dump(exclude={'context_files'}).items():
        config.set(firewall_id, key, str(value))
    for i, file_path in enumerate(host_config.context_files, 1):
        config.set(firewall_id, f'context_file_{i}', file_path)
    with open(config_path, 'w') as configfile:
        config.write(configfile)
    return {"status": "success", "message": f"Host {firewall_id} updated."}

@app.delete("/api/hosts/{firewall_id}", response_model=Dict)
async def delete_host(firewall_id: str, test_mode: bool = False):
    config_path = get_active_config_file(test_mode)
    config = configparser.ConfigParser(interpolation=None)
    config.read(config_path)
    if not config.has_section(firewall_id):
        raise HTTPException(status_code=404, detail="Host not found")
    config.remove_section(firewall_id)
    with open(config_path, 'w') as configfile:
        config.write(configfile)
    return {"status": "success", "message": f"Host {firewall_id} deleted."}

# --- UTILITY ENDPOINTS FOR FORM ---
@app.get("/api/gemini-models", response_model=Dict[str, str])
async def get_gemini_models():
    if not os.path.exists(MODEL_LIST_FILE):
        raise HTTPException(status_code=500, detail=f"File '{MODEL_LIST_FILE}' not found.")
    config = configparser.ConfigParser()
    config.read(MODEL_LIST_FILE)
    if 'GeminiModels' not in config: return {}
    return dict(config.items('GeminiModels'))

@app.get("/api/context-files", response_model=List[str])
async def get_context_files(test_mode: bool = False):
    try:
        sys_config = get_system_config_parser(test_mode)
        context_dir = sys_config.get('System', 'context_directory', fallback='').strip()
        if not context_dir or not os.path.isdir(context_dir):
            return []
        files = [f for f in os.listdir(context_dir) if os.path.isfile(os.path.join(context_dir, f))]
        return files
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/upload/context", response_model=Dict[str, str])
async def upload_context_file(test_mode: bool = False, file: UploadFile = File(...)):
    sys_config = get_system_config_parser(test_mode)
    context_dir = sys_config.get('System', 'context_directory', fallback='').strip()
    
    # // fix: Kiem tra path truoc khi thuc hien
    if not context_dir:
        raise HTTPException(status_code=400, detail="Context directory is not configured in system settings.")
        
    os.makedirs(context_dir, exist_ok=True)
    
    safe_filename = os.path.basename(file.filename)
    if not safe_filename:
        raise HTTPException(status_code=400, detail="Invalid filename.")
        
    file_path = os.path.join(context_dir, safe_filename)
    
    if os.path.exists(file_path):
        raise HTTPException(status_code=409, detail=f"File '{safe_filename}' already exists.")

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save file: {e}")
    finally:
        file.file.close()

    return {"status": "success", "filename": safe_filename, "path": file_path}

# --- EXISTING ENDPOINTS ---
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
            try:
                path_parts = os.path.normpath(file_path).split(os.sep)
                report_dir_base = os.path.basename(report_dir)
                firewall_id_from_path = path_parts[path_parts.index(report_dir_base) + 1]
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
            except Exception as e:
                logging.warning(f"Could not read or parse stats from {file_path}: {e}")
            reports.append(ReportInfo(
                filename=os.path.basename(file_path), path=file_path,
                hostname=hostname_map.get(firewall_id_from_path, 'Unknown'), type=report_type,
                generated_time=gen_time.strftime('%Y-%m-%d %H:%M:%S'), summary_stats=report_summary_stats
            ))
        return reports
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
                    profile_name=profile_name, server=profile_sec.get('server'), port=profile_sec.getint('port'),
                    sender_email=profile_sec.get('sender_email'), sender_password=profile_sec.get('sender_password', '')
                )
        settings.smtp_profiles = profiles
        return settings
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/system-settings", response_model=Dict[str, str])
async def update_system_settings(settings: SystemSettings, test_mode: bool = False):
    try:
        config_path = get_system_settings_path(test_mode)
        config = get_system_config_parser(test_mode)
        for section in config.sections():
            if section.startswith('Email_'):
                config.remove_section(section)
        if 'System' not in config: config.add_section('System')
        config.set('System', 'report_directory', settings.report_directory or '')
        config.set('System', 'prompt_directory', settings.prompt_directory or '')
        config.set('System', 'context_directory', settings.context_directory or '')
        config.set('System', 'active_smtp_profile', settings.active_smtp_profile or '')
        config.set('System', 'attach_context_files', str(settings.attach_context_files))
        config.set('System', 'scheduler_check_interval_seconds', str(settings.scheduler_check_interval_seconds))
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
        raise HTTPException(status_code=500, detail=f"Failed to save settings: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="127.0.0.1", port=8000, reload=True)