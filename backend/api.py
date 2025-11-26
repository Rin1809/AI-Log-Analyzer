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
from fastapi.staticfiles import StaticFiles 
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import List, Dict, Any, Optional

import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from modules import state_manager
from modules.report_generator import slugify
from modules.utils import file_lock, verify_safe_path
from modules.log_reader import count_file_lines

# --- config ---
CONFIG_FILE = "config.ini"
TEST_CONFIG_FILE = "test_assets/test_config.ini"
SYSTEM_SETTINGS_FILE = "system_settings.ini"
TEST_SYSTEM_SETTINGS_FILE = "system_settings_test.ini"
MODEL_LIST_FILE = "model_list.ini"

# // Explicit allowed extensions for context upload
ALLOWED_CONTEXT_EXTENSIONS = {
    '.pdf', '.txt', '.md', '.json', '.log',
    '.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif'
}

LOGGING_FORMAT = '%(asctime)s - %(levelname)s - %(message)s'
logging.basicConfig(level=logging.INFO, format=LOGGING_FORMAT)

app = FastAPI(title="AI-log-analyzer API", version="5.1.0")

origins = ["http://localhost", "http://localhost:3000"]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"], allow_origin_regex='https?://.*')

def get_active_config_file(test_mode: bool) -> str:
    return TEST_CONFIG_FILE if test_mode else CONFIG_FILE

def get_system_settings_path(test_mode: bool = False) -> str:
    return TEST_SYSTEM_SETTINGS_FILE if test_mode else SYSTEM_SETTINGS_FILE

def get_system_config_parser(test_mode: bool = False) -> configparser.ConfigParser:
    config_path = get_system_settings_path(test_mode)
    config = configparser.ConfigParser(interpolation=None, allow_no_value=True)
    
    if not os.path.exists(config_path):
        with file_lock(config_path):
            config.add_section('System')
            with open(config_path, 'w', encoding='utf-8') as f: config.write(f)
            
    config.read(config_path, encoding='utf-8')
    return config

# --- Pydantic Models ---
class PipelineSubStage(BaseModel):
    name: str = "Worker"
    enabled: bool = True
    model: str
    prompt_file: str
    gemini_api_key: Optional[str] = ""

class PipelineSummaryConf(BaseModel):
    name: Optional[str] = "Reduce" # Added name field
    model: Optional[str] = None
    prompt_file: Optional[str] = None
    gemini_api_key: Optional[str] = ""

class PipelineStage(BaseModel):
    name: str
    enabled: bool = True
    model: str
    prompt_file: str
    recipient_emails: str = ""
    email_subject: Optional[str] = "" # // Them field custom subject
    trigger_threshold: int = 1
    substages: List[PipelineSubStage] = [] 
    summary_conf: Optional[PipelineSummaryConf] = None 
    gemini_api_key: Optional[str] = "" 

class HostStatus(BaseModel):
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
    stage_index: Optional[int] = None

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
    logo_path: Optional[str] = ''
    smtp_profiles: Dict[str, SmtpProfile] = {}
    active_smtp_profile: Optional[str] = None
    attach_context_files: bool = False
    scheduler_check_interval_seconds: int = 60
    gemini_profiles: Dict[str, str] = {} 
    
class HostConfig(BaseModel):
    syshostname: str = Field(..., min_length=1)
    logfile: str
    run_interval_seconds: int
    hourstoanalyze: int
    timezone: str
    geminiapikey: str
    networkdiagram: str
    chunk_size: Optional[int] = 8000
    smtp_profile: Optional[str] = ''
    context_files: List[str] = []
    pipeline: List[PipelineStage] = []
    enabled: bool = True 

    @field_validator('syshostname')
    @classmethod
    def validate_hostname(cls, v: str) -> str:
        if '\n' in v or '\r' in v:
            raise ValueError("Hostname contains invalid characters (newline).")
        return v.strip()

class PromptFile(BaseModel):
    filename: str
    content: str

# --- Helper Functions ---
def get_host_id(hostname: str) -> str:
    return f"Host_{hostname.replace(' ', '_')}"

def config_to_dict(config: configparser.ConfigParser, section: str) -> dict:
    if not config.has_section(section): return {}
    config_dict = dict(config.items(section))
    standard_keys = ['syshostname', 'logfile', 'hourstoanalyze', 'timezone', 'run_interval_seconds', 'geminiapikey', 'networkdiagram', 'enabled', 'smtp_profile', 'pipeline_config', 'chunk_size']
    other_context = [config.get(section, key) for key in config.options(section) if key not in standard_keys and not key.startswith('context_file_')]
    explicit_context = [config.get(section, k) for k in config.options(section) if k.startswith('context_file_')]
    config_dict['context_files'] = other_context + explicit_context
    pipeline_json = config.get(section, 'pipeline_config', fallback='[]')
    try: config_dict['pipeline'] = json.loads(pipeline_json)
    except: config_dict['pipeline'] = []
    for key in ['run_interval_seconds', 'hourstoanalyze', 'chunk_size']:
        if key in config_dict:
             try: config_dict[key] = int(config_dict[key])
             except: config_dict[key] = 8000 if key == 'chunk_size' else 0
    return config_dict

# --- API Endpoints ---
@app.get("/api/dashboard-stats", response_model=Dict[str, Any])
async def get_dashboard_stats(test_mode: bool = False):
    config = configparser.ConfigParser(interpolation=None)
    config.read(get_active_config_file(test_mode), encoding='utf-8')
    system_settings = get_system_config_parser(test_mode)
    report_dir = system_settings.get('System', 'report_directory', fallback='test_reports' if test_mode else 'reports')

    total_raw = 0
    total_analyzed = 0
    
    for section in config.sections():
        if section.startswith(('Firewall_', 'Host_')):
            if config.getboolean(section, 'enabled', fallback=True):
                log_file = config.get(section, 'LogFile', fallback='')
                if log_file and os.path.exists(log_file):
                    total_raw += count_file_lines(log_file)

    if os.path.isdir(report_dir):
        files = glob.glob(os.path.join(report_dir, '*', '**', '*.json'), recursive=True)
        for r_path in files:
            try:
                with open(r_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    # // Only count finalized reports or stage 0 main reports
                    if data.get('stage_index') == 0:
                        count = data.get('raw_log_count', 0)
                        total_analyzed += int(count) if count else 0
            except: pass

    api_stats = state_manager.get_api_usage_stats(test_mode)
    
    return {
        "total_raw_logs": total_raw,
        "total_analyzed_logs": total_analyzed,
        "total_api_calls": api_stats.get("total", 0),
        "api_usage_breakdown": api_stats.get("breakdown", {})
    }

@app.get("/api/status", response_model=List[HostStatus])
async def get_host_status(test_mode: bool = False):
    try:
        config = configparser.ConfigParser(interpolation=None)
        config.read(get_active_config_file(test_mode), encoding='utf-8')
        host_sections = [s for s in config.sections() if s.startswith(('Firewall_', 'Host_'))]
        status_list = []
        for section in host_sections:
            last_run_ts = state_manager.get_last_cycle_run_timestamp(section, test_mode)
            is_enabled = config.getboolean(section, 'enabled', fallback=True)
            pipeline = json.loads(config.get(section, 'pipeline_config', fallback='[]'))
            status_list.append(HostStatus(
                id=section, hostname=config.get(section, 'SysHostname', fallback='N/A'),
                status="Online" if is_enabled else "Disabled", is_enabled=is_enabled,
                last_run=last_run_ts.isoformat() if last_run_ts else "Never",
                stages_count=len(pipeline)
            ))
        return status_list
    except Exception as e: raise HTTPException(500, detail=str(e))

@app.post("/api/status/{host_id}/toggle", response_model=Dict)
async def toggle_host_status(host_id: str, test_mode: bool = False):
    config_path = get_active_config_file(test_mode)
    try:
        with file_lock(config_path):
            config = configparser.ConfigParser(interpolation=None)
            config.read(config_path, encoding='utf-8')
            if host_id not in config: raise HTTPException(404)
            curr = config.getboolean(host_id, 'enabled', fallback=True)
            config.set(host_id, 'enabled', str(not curr))
            with open(config_path, 'w', encoding='utf-8') as f: config.write(f)
        return {"status": "toggled"}
    except TimeoutError: raise HTTPException(503)

@app.get("/api/hosts/{host_id}", response_model=Dict)
async def get_host_details(host_id: str, test_mode: bool = False):
    config = configparser.ConfigParser(interpolation=None)
    config.read(get_active_config_file(test_mode), encoding='utf-8')
    if not config.has_section(host_id): raise HTTPException(404)
    return config_to_dict(config, host_id)

@app.post("/api/hosts", response_model=Dict)
async def create_host(host_config: HostConfig, test_mode: bool = False):
    host_id = get_host_id(host_config.syshostname)
    config_path = get_active_config_file(test_mode)
    try:
        with file_lock(config_path):
            config = configparser.ConfigParser(interpolation=None)
            config.read(config_path, encoding='utf-8')
            if config.has_section(host_id): raise HTTPException(409)
            config.add_section(host_id)
            for key, value in host_config.model_dump(exclude={'context_files', 'pipeline', 'enabled'}).items():
                config.set(host_id, key, str(value))
            for i, file_path in enumerate(host_config.context_files, 1):
                config.set(host_id, f'context_file_{i}', file_path)
            config.set(host_id, 'pipeline_config', json.dumps([s.model_dump() for s in host_config.pipeline]))
            config.set(host_id, 'enabled', str(host_config.enabled))
            with open(config_path, 'w', encoding='utf-8') as f: config.write(f)
        return {"status": "success"}
    except TimeoutError: raise HTTPException(503)

@app.put("/api/hosts/{host_id}", response_model=Dict)
async def update_host(host_id: str, host_config: HostConfig, test_mode: bool = False):
    config_path = get_active_config_file(test_mode)
    try:
        with file_lock(config_path):
            config = configparser.ConfigParser(interpolation=None)
            config.read(config_path, encoding='utf-8')
            if not config.has_section(host_id): raise HTTPException(404)
            new_host_id = get_host_id(host_config.syshostname)
            if new_host_id != host_id and config.has_section(new_host_id): raise HTTPException(409)
            
            sys_settings = get_system_config_parser(test_mode)
            base_report_dir = sys_settings.get('System', 'report_directory', fallback='test_reports' if test_mode else 'reports')
            if new_host_id != host_id:
                try: os.rename(os.path.join(base_report_dir, host_id), os.path.join(base_report_dir, new_host_id))
                except: pass
            
            config.remove_section(host_id)
            config.add_section(new_host_id)
            config.set(new_host_id, 'enabled', str(host_config.enabled))
            for key, value in host_config.model_dump(exclude={'context_files', 'pipeline', 'enabled'}).items():
                config.set(new_host_id, key, str(value))
            for i, file_path in enumerate(host_config.context_files, 1):
                config.set(new_host_id, f'context_file_{i}', file_path)
            config.set(new_host_id, 'pipeline_config', json.dumps([s.model_dump() for s in host_config.pipeline]))
            with open(config_path, 'w', encoding='utf-8') as f: config.write(f)
            return {"status": "success", "new_id": new_host_id}
    except TimeoutError: raise HTTPException(503)

@app.delete("/api/hosts/{host_id}", response_model=Dict)
async def delete_host(host_id: str, test_mode: bool = False):
    config_path = get_active_config_file(test_mode)
    try:
        with file_lock(config_path):
            config = configparser.ConfigParser(interpolation=None)
            config.read(config_path, encoding='utf-8')
            if not config.has_section(host_id): raise HTTPException(404)
            config.remove_section(host_id)
            with open(config_path, 'w', encoding='utf-8') as f: config.write(f)
        return {"status": "deleted"}
    except TimeoutError: raise HTTPException(503)

@app.get("/api/gemini-models", response_model=Dict[str, str])
async def get_gemini_models():
    if not os.path.exists(MODEL_LIST_FILE): return {}
    config = configparser.ConfigParser(); config.read(MODEL_LIST_FILE, encoding='utf-8')
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
    if not context_dir: raise HTTPException(400)
    os.makedirs(context_dir, exist_ok=True)
    
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_CONTEXT_EXTENSIONS:
        raise HTTPException(400, detail=f"File type '{ext}' not allowed. Allowed: {', '.join(ALLOWED_CONTEXT_EXTENSIONS)}")

    path = os.path.join(context_dir, os.path.basename(file.filename))
    with open(path, "wb") as b: shutil.copyfileobj(file.file, b)
    return {"filename": file.filename, "path": path}

@app.delete("/api/context-files/{filename}", response_model=Dict)
async def delete_context_file(filename: str, test_mode: bool = False):
    sys_config = get_system_config_parser(test_mode)
    context_dir = sys_config.get('System', 'context_directory', fallback='').strip()
    full_path = os.path.join(context_dir, filename)
    try: safe_path = verify_safe_path(context_dir, full_path)
    except: raise HTTPException(403)
    if os.path.exists(safe_path): os.remove(safe_path)
    return {"status": "deleted"}

@app.get("/api/prompts", response_model=List[str])
async def list_prompts(test_mode: bool = False):
    sys_config = get_system_config_parser(test_mode)
    prompt_dir = sys_config.get('System', 'prompt_directory', fallback='prompts')
    if not os.path.isdir(prompt_dir): return []
    return [f for f in os.listdir(prompt_dir) if f.endswith('.md')]

@app.get("/api/prompts/{filename}")
async def get_prompt_content(filename: str, test_mode: bool = False):
    sys_config = get_system_config_parser(test_mode)
    prompt_dir = sys_config.get('System', 'prompt_directory', fallback='prompts')
    try: safe_path = verify_safe_path(prompt_dir, os.path.join(prompt_dir, filename))
    except: raise HTTPException(403)
    if not os.path.exists(safe_path): raise HTTPException(404)
    with open(safe_path, 'r', encoding='utf-8') as f: return {"filename": filename, "content": f.read()}

@app.post("/api/prompts")
async def save_prompt(prompt: PromptFile, test_mode: bool = False):
    sys_config = get_system_config_parser(test_mode)
    prompt_dir = sys_config.get('System', 'prompt_directory', fallback='prompts')
    os.makedirs(prompt_dir, exist_ok=True)
    safe_name = os.path.basename(prompt.filename)
    if not safe_name.endswith('.md'): safe_name += '.md'
    try: safe_path = verify_safe_path(prompt_dir, os.path.join(prompt_dir, safe_name))
    except: raise HTTPException(403)
    with open(safe_path, 'w', encoding='utf-8') as f: f.write(prompt.content)
    return {"status": "saved", "filename": safe_name}

@app.delete("/api/prompts/{filename}")
async def delete_prompt(filename: str, test_mode: bool = False):
    if filename in ['prompt_template.md', 'summary_prompt_template.md', 'final_summary_prompt_template.md']: raise HTTPException(403)
    sys_config = get_system_config_parser(test_mode)
    prompt_dir = sys_config.get('System', 'prompt_directory', fallback='prompts')
    try: safe_path = verify_safe_path(prompt_dir, os.path.join(prompt_dir, filename))
    except: raise HTTPException(403)
    if os.path.exists(safe_path): os.remove(safe_path)
    return {"status": "deleted"}

@app.get("/api/reports", response_model=List[ReportInfo])
async def get_all_reports(test_mode: bool = False):
    config = configparser.ConfigParser(interpolation=None); config.read(get_active_config_file(test_mode), encoding='utf-8')
    system_settings = get_system_config_parser(test_mode)
    report_dir = system_settings.get('System', 'report_directory', fallback='test_reports' if test_mode else 'reports')
    if not os.path.isdir(report_dir): return []
    hostname_map = {s: config.get(s, 'SysHostname', fallback=s) for s in config.sections() if s.startswith(('Firewall_', 'Host_'))}
    reports = []
    files = glob.glob(os.path.join(report_dir, '*', '**', '*.json'), recursive=True)
    files.sort(key=os.path.getmtime, reverse=True)
    for file_path in files:
        try:
            parts = os.path.normpath(file_path).split(os.sep)
            host_id = next((p for p in parts if p.startswith(('Firewall_', 'Host_'))), None)
            if not host_id: continue 
            with open(file_path, 'r', encoding='utf-8') as f: 
                content = json.load(f)

                stats = content.get('summary_stats', {})
                if 'raw_log_count' not in stats and 'raw_log_count' in content:
                    stats['raw_log_count'] = content['raw_log_count']
                
                reports.append(ReportInfo(
                    filename=os.path.basename(file_path), path=file_path,
                    hostname=hostname_map.get(host_id, host_id), type=content.get('report_type', 'unknown'),
                    generated_time=datetime.fromtimestamp(os.path.getmtime(file_path)).strftime('%Y-%m-%d %H:%M:%S'),
                    summary_stats=stats, 
                    stage_index=content.get('stage_index', None)
                ))
        except: pass
    return reports

@app.get("/api/report-content", response_model=Dict)
async def get_report_content(path: str, test_mode: bool = False):
    sys_settings = get_system_config_parser(test_mode)
    base_report_dir = sys_settings.get('System', 'report_directory', fallback='reports')
    try: safe_path = verify_safe_path(base_report_dir, os.path.join(base_report_dir, path))
    except:
         try: safe_path = verify_safe_path(base_report_dir, path)
         except: raise HTTPException(403)
    if not os.path.exists(safe_path): raise HTTPException(404)
    with open(safe_path, 'r', encoding='utf-8') as f: return json.load(f)

@app.delete("/api/reports", response_model=Dict)
async def delete_report(path: str, test_mode: bool = False):
    sys_settings = get_system_config_parser(test_mode)
    base_report_dir = sys_settings.get('System', 'report_directory', fallback='reports')
    try: safe_path = verify_safe_path(base_report_dir, os.path.join(base_report_dir, path))
    except:
        try: safe_path = verify_safe_path(base_report_dir, path)
        except: raise HTTPException(403)
    if os.path.exists(safe_path): os.remove(safe_path)
    return {"status": "deleted"}

@app.get("/api/reports/download")
async def download_report(path: str, test_mode: bool = False):
    sys_settings = get_system_config_parser(test_mode)
    base_report_dir = sys_settings.get('System', 'report_directory', fallback='reports')
    try: safe_path = verify_safe_path(base_report_dir, os.path.join(base_report_dir, path))
    except:
        try: safe_path = verify_safe_path(base_report_dir, path)
        except: raise HTTPException(403)
    return FileResponse(path=safe_path, filename=os.path.basename(safe_path), media_type='application/json')

@app.get("/api/reports/preview", response_model=Dict)
async def preview_report_email(path: str, test_mode: bool = False):
    sys_settings = get_system_config_parser(test_mode)
    base_report_dir = sys_settings.get('System', 'report_directory', fallback='reports')
    try: safe_path = verify_safe_path(base_report_dir, os.path.join(base_report_dir, path))
    except:
         try: safe_path = verify_safe_path(base_report_dir, path)
         except: raise HTTPException(403)

    if not os.path.exists(safe_path): raise HTTPException(404)
    
    try:
        with open(safe_path, 'r', encoding='utf-8') as f: data = json.load(f)
        prompt_dir = sys_settings.get('System', 'prompt_directory', fallback='prompts')
        is_summary = 'summary' in data.get('report_type', 'unknown').lower()
        tpl_path = os.path.join(prompt_dir, '..', 'summary_email_template.html' if is_summary else 'email_template.html')
        if not os.path.exists(tpl_path): tpl_path = os.path.join('summary_email_template.html' if is_summary else 'email_template.html')

        with open(tpl_path, 'r', encoding='utf-8') as f: template = f.read()

        stats = data.get('summary_stats', {})
        html_analysis = markdown.markdown(data.get('analysis_details_markdown', ''))
        st_str, et_str = data.get('analysis_start_time', ''), data.get('analysis_end_time', '')
        try:
            st = datetime.fromisoformat(st_str).strftime('%H:%M %d-%m')
            et = datetime.fromisoformat(et_str).strftime('%H:%M %d-%m')
        except: st, et = "?", "?"

        # Generic Mapping Logic for Preview
        final_html = template.format(
            hostname=data.get('hostname', 'Unknown'), 
            analysis_result=html_analysis,
            stat_1_label=stats.get("stat_1_label", "Metric 1"),
            stat_1_value=stats.get("stat_1_value", "N/A"),
            stat_2_label=stats.get("stat_2_label", "Metric 2"),
            stat_2_value=stats.get("stat_2_value", "N/A"),
            stat_3_label=stats.get("stat_3_label", "Metric 3"),
            stat_3_value=stats.get("stat_3_value", "N/A"),
            short_summary=stats.get("short_summary", "Không có tóm tắt"),
            start_time=st, end_time=et
        )
        return {"html": final_html}
    except Exception as e: return {"html": f"<h1>Rendering Error</h1><p>{str(e)}</p>"}

@app.get("/api/system-settings", response_model=SystemSettings)
async def get_settings(test_mode: bool = False):
    conf = get_system_config_parser(test_mode)
    settings = SystemSettings()
    if 'System' in conf:
        s = conf['System']
        settings.report_directory = s.get('report_directory', '')
        settings.prompt_directory = s.get('prompt_directory', '')
        settings.context_directory = s.get('context_directory', '')
        settings.logo_path = s.get('logo_path', '')
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
    if conf.has_section('Gemini_Keys'):
        settings.gemini_profiles = dict(conf.items('Gemini_Keys'))
    return settings

@app.post("/api/system-settings", response_model=Dict)
async def save_settings(settings: SystemSettings, test_mode: bool = False):
    path = get_system_settings_path(test_mode)
    try:
        with file_lock(path):
            conf = get_system_config_parser(test_mode)
            for s in conf.sections(): 
                if s.startswith('Email_'): conf.remove_section(s)
            if 'System' not in conf: conf.add_section('System')
            sys = conf['System']
            sys['report_directory'] = settings.report_directory
            sys['prompt_directory'] = settings.prompt_directory
            sys['context_directory'] = settings.context_directory
            sys['logo_path'] = settings.logo_path or ''
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
            if 'Gemini_Keys' not in conf: conf.add_section('Gemini_Keys')
            conf.remove_section('Gemini_Keys'); conf.add_section('Gemini_Keys')
            for name, key in settings.gemini_profiles.items(): conf.set('Gemini_Keys', name, key)
            with open(path, 'w', encoding='utf-8') as f: conf.write(f)
        return {"status": "saved"}
    except TimeoutError: raise HTTPException(503)

if os.path.exists("../frontend/build"):
    app.mount("/", StaticFiles(directory="../frontend/build", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="127.0.0.1", port=8000, reload=True)