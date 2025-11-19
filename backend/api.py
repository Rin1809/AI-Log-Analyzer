import os
import glob
import json
import configparser
import logging
import shutil
import markdown
from datetime import datetime

from fastapi import FastAPI, HTTPException, Body, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
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

app = FastAPI(title="AI-log-analyzer API", version="4.1.0")

origins = ["http://localhost", "http://localhost:3000"]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

def get_active_config_file(test_mode: bool) -> str:
    return TEST_CONFIG_FILE if test_mode else CONFIG_FILE

def get_system_settings_path(test_mode: bool = False) -> str:
    return TEST_SYSTEM_SETTINGS_FILE if test_mode else SYSTEM_SETTINGS_FILE

def get_system_config_parser(test_mode: bool = False) -> configparser.ConfigParser:
    config_path = get_system_settings_path(test_mode)
    config = configparser.ConfigParser(interpolation=None, allow_no_value=True)
    if not os.path.exists(config_path):
        config.add_section('System')
        with open(config_path, 'w') as f: config.write(f)
    config.read(config_path)
    return config

# --- Pydantic Models ---
class PipelineStage(BaseModel):
    name: str
    enabled: bool = True
    model: str
    prompt_file: str
    recipient_emails: str = ""
    trigger_threshold: int = 1

class FirewallStatus(BaseModel):
    id: str
    hostname: str
    status: str
    is_enabled: bool
    last_run: Optional[str] = None
    stages_count: int = 0

class ReportInfo(BaseModel):
    filename: str
    path: str
    hostname: str
    type: str
    generated_time: str
    summary_stats: Optional[Dict[str, Any]] = None

class SmtpProfile(BaseModel):
    profile_name: str
    server: str
    port: int
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
    geminiapikey: str
    networkdiagram: str
    smtp_profile: Optional[str] = ''
    context_files: List[str] = []
    pipeline: List[PipelineStage] = []

# --- Helper Functions ---
def get_firewall_id(hostname: str) -> str:
    return f"Firewall_{hostname.replace(' ', '_')}"

def config_to_dict(config: configparser.ConfigParser, section: str) -> dict:
    if not config.has_section(section): return {}
    config_dict = dict(config.items(section))
    
    standard_keys = ['syshostname', 'logfile', 'hourstoanalyze', 'timezone', 'run_interval_seconds', 'geminiapikey', 'networkdiagram', 'enabled', 'smtp_profile', 'pipeline_config']
    context_keys = [key for key in config.options(section) if key not in standard_keys and not key.startswith('context_file_')]
    config_dict['context_files'] = [config.get(section, key) for key in context_keys]

    pipeline_json = config.get(section, 'pipeline_config', fallback='[]')
    try:
        config_dict['pipeline'] = json.loads(pipeline_json)
    except json.JSONDecodeError:
        config_dict['pipeline'] = []

    for key in ['run_interval_seconds', 'hourstoanalyze']:
        if key in config_dict:
             try: config_dict[key] = int(config_dict[key])
             except: config_dict[key] = 0
             
    return config_dict

# --- API Endpoints ---

# ... (Status/Host APIs giu nguyen - luoc bot cho gon, chi show thay doi) ...

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
            pipeline = json.loads(config.get(section, 'pipeline_config', fallback='[]'))
            
            status_list.append(FirewallStatus(
                id=section,
                hostname=config.get(section, 'SysHostname', fallback='N/A'),
                status="Online" if is_enabled else "Disabled",
                is_enabled=is_enabled,
                last_run=last_run_ts.isoformat() if last_run_ts else "Never",
                stages_count=len(pipeline)
            ))
        return status_list
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/status/{firewall_id}/toggle", response_model=Dict)
async def toggle_firewall_status(firewall_id: str, test_mode: bool = False):
    config_path = get_active_config_file(test_mode)
    config = configparser.ConfigParser(interpolation=None)
    config.read(config_path)
    if firewall_id not in config: raise HTTPException(status_code=404, detail="ID not found")
    
    curr = config.getboolean(firewall_id, 'enabled', fallback=True)
    config.set(firewall_id, 'enabled', str(not curr))
    with open(config_path, 'w') as f: config.write(f)
    return {"status": "toggled"}

@app.get("/api/hosts/{firewall_id}", response_model=Dict)
async def get_host_details(firewall_id: str, test_mode: bool = False):
    config = configparser.ConfigParser(interpolation=None)
    config.read(get_active_config_file(test_mode))
    if not config.has_section(firewall_id): raise HTTPException(status_code=404, detail="Host not found")
    return config_to_dict(config, firewall_id)

@app.post("/api/hosts", response_model=Dict)
async def create_host(host_config: HostConfig, test_mode: bool = False):
    firewall_id = get_firewall_id(host_config.syshostname)
    config_path = get_active_config_file(test_mode)
    config = configparser.ConfigParser(interpolation=None)
    config.read(config_path)
    if config.has_section(firewall_id): raise HTTPException(status_code=409, detail="Host exists")
    
    config.add_section(firewall_id)
    for key, value in host_config.model_dump(exclude={'context_files', 'pipeline'}).items():
        config.set(firewall_id, key, str(value))
    for i, file_path in enumerate(host_config.context_files, 1):
        config.set(firewall_id, f'context_file_{i}', file_path)
    pipeline_json = json.dumps([s.model_dump() for s in host_config.pipeline])
    config.set(firewall_id, 'pipeline_config', pipeline_json)
    config.set(firewall_id, 'enabled', 'True')
    with open(config_path, 'w') as f: config.write(f)
    return {"status": "success"}

@app.put("/api/hosts/{firewall_id}", response_model=Dict)
async def update_host(firewall_id: str, host_config: HostConfig, test_mode: bool = False):
    config_path = get_active_config_file(test_mode)
    config = configparser.ConfigParser(interpolation=None)
    config.read(config_path)
    if not config.has_section(firewall_id): raise HTTPException(status_code=404, detail="Host not found")
    
    old_enabled = config.get(firewall_id, 'enabled', fallback='True')
    config.remove_section(firewall_id)
    config.add_section(firewall_id)
    config.set(firewall_id, 'enabled', old_enabled)
    
    for key, value in host_config.model_dump(exclude={'context_files', 'pipeline'}).items():
        config.set(firewall_id, key, str(value))
    for i, file_path in enumerate(host_config.context_files, 1):
        config.set(firewall_id, f'context_file_{i}', file_path)
    pipeline_json = json.dumps([s.model_dump() for s in host_config.pipeline])
    config.set(firewall_id, 'pipeline_config', pipeline_json)
        
    with open(config_path, 'w') as f: config.write(f)
    return {"status": "success"}

@app.delete("/api/hosts/{firewall_id}", response_model=Dict)
async def delete_host(firewall_id: str, test_mode: bool = False):
    config_path = get_active_config_file(test_mode)
    config = configparser.ConfigParser(interpolation=None)
    config.read(config_path)
    if not config.has_section(firewall_id): raise HTTPException(status_code=404)
    config.remove_section(firewall_id)
    with open(config_path, 'w') as f: config.write(f)
    return {"status": "deleted"}

@app.get("/api/gemini-models", response_model=Dict[str, str])
async def get_gemini_models():
    if not os.path.exists(MODEL_LIST_FILE): return {}
    config = configparser.ConfigParser()
    config.read(MODEL_LIST_FILE)
    if 'GeminiModels' not in config: return {}
    return dict(config.items('GeminiModels'))

@app.get("/api/context-files", response_model=List[str])
async def get_context_files(test_mode: bool = False):
    sys_config = get_system_config_parser(test_mode)
    context_dir = sys_config.get('System', 'context_directory', fallback='').strip()
    if not context_dir or not os.path.isdir(context_dir): return []
    return [f for f in os.listdir(context_dir) if os.path.isfile(os.path.join(context_dir, f))]

@app.post("/api/upload/context", response_model=Dict)
async def upload_context_file(test_mode: bool = False, file: UploadFile = File(...)):
    sys_config = get_system_config_parser(test_mode)
    context_dir = sys_config.get('System', 'context_directory', fallback='').strip()
    if not context_dir: raise HTTPException(400, "Context dir not configured")
    os.makedirs(context_dir, exist_ok=True)
    path = os.path.join(context_dir, os.path.basename(file.filename))
    with open(path, "wb") as b: shutil.copyfileobj(file.file, b)
    return {"filename": file.filename, "path": path}

@app.delete("/api/context-files/{filename}", response_model=Dict)
async def delete_context_file(filename: str, test_mode: bool = False):
    sys_config = get_system_config_parser(test_mode)
    context_dir = sys_config.get('System', 'context_directory', fallback='').strip()
    path = os.path.join(context_dir, filename)
    if os.path.exists(path): os.remove(path)
    return {"status": "deleted"}

# --- Reports APIs ---

@app.get("/api/reports", response_model=List[ReportInfo])
async def get_all_reports(test_mode: bool = False):
    try:
        config = configparser.ConfigParser(interpolation=None)
        config.read(get_active_config_file(test_mode))
        system_settings = get_system_config_parser(test_mode)
        default_report_dir = 'test_reports' if test_mode else 'reports'
        report_dir = system_settings.get('System', 'report_directory', fallback=default_report_dir)
        
        if not os.path.isdir(report_dir): return []
        
        hostname_map = {s: config.get(s, 'SysHostname', fallback=s) for s in config.sections() if s.startswith('Firewall_')}
        reports = []
        files = glob.glob(os.path.join(report_dir, 'Firewall_*', '**', '*.json'), recursive=True)
        files.sort(key=os.path.getmtime, reverse=True)
        
        for file_path in files:
            try:
                parts = os.path.normpath(file_path).split(os.sep)
                fw_id = next((p for p in parts if p.startswith('Firewall_')), "Unknown")
                
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = json.load(f)
                r_type = content.get('report_type', 'unknown')
                reports.append(ReportInfo(
                    filename=os.path.basename(file_path), path=file_path,
                    hostname=hostname_map.get(fw_id, fw_id), type=r_type,
                    generated_time=datetime.fromtimestamp(os.path.getmtime(file_path)).strftime('%Y-%m-%d %H:%M:%S'),
                    summary_stats=content.get('summary_stats', {})
                ))
            except: pass
        return reports
    except Exception as e: raise HTTPException(500, str(e))

@app.get("/api/report-content", response_model=Dict)
async def get_report_content(path: str):
    if not os.path.exists(path): raise HTTPException(404, "Report file not found")
    with open(path, 'r', encoding='utf-8') as f: return json.load(f)

@app.delete("/api/reports", response_model=Dict)
async def delete_report(path: str):
    if not os.path.exists(path): raise HTTPException(404, "Report file not found")
    try:
        os.remove(path)
        return {"status": "deleted", "path": path}
    except Exception as e:
        raise HTTPException(500, f"Failed to delete report: {str(e)}")

@app.get("/api/reports/download")
async def download_report(path: str):
    if not os.path.exists(path): raise HTTPException(404, "Report file not found")
    return FileResponse(path=path, filename=os.path.basename(path), media_type='application/json')

@app.get("/api/reports/preview", response_model=Dict)
async def preview_report_email(path: str, test_mode: bool = False):
    # // Logic nay tai su dung logic cua main.py de render HTML
    if not os.path.exists(path): raise HTTPException(404, "Report file not found")
    
    try:
        with open(path, 'r', encoding='utf-8') as f: data = json.load(f)
        
        system_settings = get_system_config_parser(test_mode)
        prompt_dir = system_settings.get('System', 'prompt_directory', fallback='prompts')
        
        # Determine template
        r_type = data.get('report_type', 'unknown')
        is_summary = 'summary' in r_type.lower()
        
        # Path resolution for templates (assume relative to backend root/prompts)
        if is_summary:
            tpl_path = os.path.join(prompt_dir, '..', 'summary_email_template.html')
            if not os.path.exists(tpl_path): tpl_path = os.path.join('summary_email_template.html')
        else:
            tpl_path = os.path.join(prompt_dir, '..', 'email_template.html')
            if not os.path.exists(tpl_path): tpl_path = os.path.join('email_template.html')
            
        if not os.path.exists(tpl_path): 
            return {"html": f"<h1>Error</h1><p>Template not found at {tpl_path}</p>"}

        with open(tpl_path, 'r', encoding='utf-8') as f: template = f.read()

        stats = data.get('summary_stats', {})
        hostname = data.get('hostname', 'Unknown')
        md_content = data.get('analysis_details_markdown', '')
        html_analysis = markdown.markdown(md_content)
        
        # Safe date parsing
        st_str = data.get('analysis_start_time', '')
        et_str = data.get('analysis_end_time', '')
        try:
            st = datetime.fromisoformat(st_str).strftime('%H:%M %d-%m')
            et = datetime.fromisoformat(et_str).strftime('%H:%M %d-%m')
        except:
            st, et = "?", "?"

        # Mapping keys based on template type
        if is_summary:
             # Map Summary JSON to Template
            issue = stats.get("most_frequent_issue") or stats.get("key_strategic_recommendation") or "N/A"
            blocked = stats.get("total_blocked_events_period") or stats.get("total_critical_events_final") or "N/A"
            alert_count = stats.get("total_alerts_period", "N/A")
            
            final_html = template.format(
                hostname=hostname, analysis_result=html_analysis,
                total_blocked=blocked, top_issue=issue, critical_alerts=alert_count,
                start_time=st, end_time=et,
                # Fallbacks for keys that might not exist in template
                security_trend=stats.get("overall_security_trend", "N/A"),
                key_recommendation=stats.get("key_strategic_recommendation", "N/A"),
                total_events=stats.get("total_critical_events_final", "N/A")
            )
        else:
            # Map Periodic JSON to Template
            final_html = template.format(
                hostname=hostname, analysis_result=html_analysis,
                total_blocked=stats.get("total_blocked_events", "0"),
                top_ip=stats.get("top_blocked_source_ip", "N/A"),
                critical_alerts=stats.get("alerts_count", "0"),
                start_time=st, end_time=et
            )
            
        return {"html": final_html}
    except Exception as e:
         return {"html": f"<h1>Rendering Error</h1><p>{str(e)}</p>"}

# ... (Settings APIs giu nguyen) ...

@app.get("/api/system-settings", response_model=SystemSettings)
async def get_settings(test_mode: bool = False):
    conf = get_system_config_parser(test_mode)
    settings = SystemSettings()
    if 'System' in conf:
        s = conf['System']
        settings.report_directory = s.get('report_directory', '')
        settings.prompt_directory = s.get('prompt_directory', '')
        settings.context_directory = s.get('context_directory', '')
        settings.active_smtp_profile = s.get('active_smtp_profile')
        settings.attach_context_files = s.getboolean('attach_context_files', False)
        settings.scheduler_check_interval_seconds = s.getint('scheduler_check_interval_seconds', 60)
    
    profiles = {}
    for sec in conf.sections():
        if sec.startswith('Email_'):
            p = conf[sec]
            profiles[sec[6:]] = SmtpProfile(
                profile_name=sec[6:], server=p.get('server'), port=p.getint('port'),
                sender_email=p.get('sender_email'), sender_password=p.get('sender_password', '')
            )
    settings.smtp_profiles = profiles
    return settings

@app.post("/api/system-settings", response_model=Dict)
async def save_settings(settings: SystemSettings, test_mode: bool = False):
    path = get_system_settings_path(test_mode)
    conf = get_system_config_parser(test_mode)
    for s in conf.sections(): 
        if s.startswith('Email_'): conf.remove_section(s)
        
    if 'System' not in conf: conf.add_section('System')
    sys = conf['System']
    sys['report_directory'] = settings.report_directory
    sys['prompt_directory'] = settings.prompt_directory
    sys['context_directory'] = settings.context_directory
    sys['active_smtp_profile'] = settings.active_smtp_profile or ''
    sys['attach_context_files'] = str(settings.attach_context_files)
    sys['scheduler_check_interval_seconds'] = str(settings.scheduler_check_interval_seconds)
    
    for name, prof in settings.smtp_profiles.items():
        sec = f'Email_{name}'
        conf.add_section(sec)
        conf[sec]['server'] = prof.server
        conf[sec]['port'] = str(prof.port)
        conf[sec]['sender_email'] = prof.sender_email
        conf[sec]['sender_password'] = prof.sender_password
        
    with open(path, 'w') as f: conf.write(f)
    return {"status": "saved"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="127.0.0.1", port=8000, reload=True)