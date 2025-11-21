import os
import smtplib
import logging
import configparser
import markdown
import pytz
import time
import json
import re
import glob
import concurrent.futures
from datetime import datetime

from modules import state_manager
from modules import log_reader
from modules import gemini_analyzer
from modules import email_service
from modules import report_generator
from modules import context_loader
from modules import utils

CONFIG_FILE = "config.ini"
SYSTEM_SETTINGS_FILE = "system_settings.ini"

LOGGING_FORMAT = '%(asctime)s - %(levelname)s - %(message)s'
logging.basicConfig(level=logging.INFO, format=LOGGING_FORMAT)

def get_smtp_config_for_stage(system_settings, host_config, host_section, stage_config=None):
    host_profile = host_config.get(host_section, 'smtp_profile', fallback='').strip()
    system_default = system_settings.get('System', 'active_smtp_profile', fallback=None)
    profile_to_use = host_profile if host_profile else system_default

    if not profile_to_use: return None
    email_sec = f"Email_{profile_to_use}"
    if not system_settings.has_section(email_sec): return None
    return dict(system_settings.items(email_sec))

def get_attachments(config, host_section, system_settings):
    if not system_settings.getboolean('System', 'attach_context_files', fallback=False):
        return []
    
    standard_keys = ['syshostname', 'logfile', 'hourstoanalyze', 'timezone', 'run_interval_seconds', 'geminiapikey', 'networkdiagram', 'enabled', 'smtp_profile', 'pipeline_config']
    attachments = []
    for key in config.options(host_section):
        if key not in standard_keys and not key.startswith('context_file_'):
             val = config.get(host_section, key).strip()
             if val and os.path.isfile(val): attachments.append(val)
        if key.startswith('context_file_'):
             val = config.get(host_section, key).strip()
             if val and os.path.isfile(val): attachments.append(val)
             
    return attachments

def resolve_api_key(raw_key, system_settings):
    """
    Giai ma key neu la profile (bat dau bang profile:).
    """
    if raw_key.startswith('profile:'):
        profile_name = raw_key.split(':', 1)[1].strip()
        if system_settings.has_section('Gemini_Keys'):
            return system_settings.get('Gemini_Keys', profile_name, fallback=raw_key)
        return raw_key # Fallback neu khong tim thay
    return raw_key

# --- PARALLEL WORKER FUNCTION ---
def process_chunk_worker(worker_config, chunk_content, host_section, bonus_context, system_settings, prompt_dir):
    """
    Worker function to process a log chunk.
    """
    worker_name = worker_config.get('name', 'Worker')
    model_name = worker_config.get('model')
    prompt_file_name = worker_config.get('prompt_file')
    raw_key = worker_config.get('gemini_api_key')
    
    api_key = resolve_api_key(raw_key, system_settings)
    prompt_file = os.path.join(prompt_dir, prompt_file_name)
    
    logging.info(f"[{host_section}] Worker '{worker_name}' processing {len(chunk_content)} chars...")
    
    result = gemini_analyzer.analyze_with_gemini(
        f"{host_section}_{worker_name}", 
        chunk_content, 
        bonus_context, 
        api_key, 
        prompt_file, 
        model_name
    )
    
    if "Gemini blocked response" in result or "Fatal Gemini Error" in result:
        raise Exception(f"Worker {worker_name} failed: {result}")
        
    return {
        "worker": worker_name,
        "result": result
    }

# --- PIPELINE EXECUTION ---

def run_pipeline_stage_0(host_config, host_section, stage_config, main_api_key, system_settings, test_mode=False):
    """
    Stage 0: RAW LOG ANALYSIS (Map-Reduce / Parallel Support)
    """
    stage_name = stage_config.get('name', 'Periodic')
    substages = stage_config.get('substages', [])
    
    logging.info(f"[{host_section}] >>> Running Stage 0: {stage_name}")
    if substages:
        logging.info(f"[{host_section}] >>> Parallel Mode: Enabled ({len(substages)} substages)")

    log_file = host_config.get(host_section, 'LogFile')
    hours = host_config.getint(host_section, 'HoursToAnalyze', fallback=24)
    hostname = host_config.get(host_section, 'SysHostname')
    timezone = host_config.get(host_section, 'TimeZone', fallback='UTC')
    
    report_dir = system_settings.get('System', 'report_directory', fallback='reports')
    prompt_dir = system_settings.get('System', 'prompt_directory', fallback='prompts')


    base_limit = 10000
    total_limit = base_limit * (1 + len(substages))
    

    read_result = log_reader.read_new_log_entries(log_file, hours, timezone, host_section, test_mode, custom_limit=total_limit)
    
    if not read_result or read_result[0] is None:
        logging.error(f"[{host_section}] Log read failed. Aborting.")
        return False

    full_log_content, start_time, end_time, log_count, candidate_timestamp = read_result

    if log_count == 0:
        logging.info(f"[{host_section}] No new logs. Advancing timestamp.")
        state_manager.save_last_run_timestamp(candidate_timestamp, host_section, test_mode)
        return True


    bonus_context = context_loader.read_bonus_context_files(host_config, host_section)
    

    workers_payload = []
    

    workers_payload.append({
        "name": "Main_Worker",
        "model": stage_config.get('model'),
        "prompt_file": stage_config.get('prompt_file'),
        "gemini_api_key": host_config.get(host_section, 'GeminiAPIKey'),
        "enabled": True
    })
    

    for sub in substages:
        if sub.get('enabled', True):
            workers_payload.append(sub)
            
    active_workers = len(workers_payload)
    


    log_lines = full_log_content.splitlines()
    chunk_size = len(log_lines) // active_workers + 1
    log_chunks = [log_lines[i:i + chunk_size] for i in range(0, len(log_lines), chunk_size)]
    


    if len(log_chunks) > active_workers:
   


        log_chunks[-2].extend(log_chunks[-1])
        log_chunks.pop()

    logging.info(f"[{host_section}] Split {log_count} lines into {len(log_chunks)} chunks for parallel processing.")



    aggregated_results = []
    failed_workers = []
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=active_workers) as executor:
        future_to_worker = {}
        for i, worker in enumerate(workers_payload):
            if i < len(log_chunks):
                chunk_str = "\n".join(log_chunks[i])
                future = executor.submit(process_chunk_worker, worker, chunk_str, host_section, bonus_context, system_settings, prompt_dir)
                future_to_worker[future] = worker['name']
        
        for future in concurrent.futures.as_completed(future_to_worker):
            w_name = future_to_worker[future]
            try:
                res = future.result()
                aggregated_results.append(res)
            except Exception as exc:
                logging.error(f"[{host_section}] Worker {w_name} generated an exception: {exc}")
                failed_workers.append(w_name)



    if failed_workers:
        logging.error(f"[{host_section}] One or more workers failed ({', '.join(failed_workers)}). Aborting batch to ensure data integrity.")
        return False




    
    final_summary_stats = {
        "total_blocked_events": 0,
        "top_blocked_source_ip": "See Details",
        "alerts_count": 0
    }
    combined_markdown = ""
    




    
    for res in aggregated_results:
        raw_text = res['result']
        stats = utils.extract_json_from_text(raw_text)
        


        try:
            val = int(stats.get("total_blocked_events", 0))
            final_summary_stats["total_blocked_events"] += val
        except: pass
        
        try:
            val = int(stats.get("alerts_count", 0))
            final_summary_stats["alerts_count"] += val
        except: pass
        

        clean_md = re.sub(r'```json\s*.*?\s*```', '', raw_text, flags=re.DOTALL | re.IGNORECASE).strip()
        combined_markdown += f"\n\n## --- Analysis Part ({res['worker']}) ---\n{clean_md}"



    report_data = {
        "hostname": hostname, 
        "analysis_start_time": start_time.isoformat(), 
        "analysis_end_time": end_time.isoformat(),
        "report_generated_time": datetime.now(pytz.timezone(timezone)).isoformat(),
        "raw_log_count": log_count, 
        "summary_stats": final_summary_stats, 
        "analysis_details_markdown": combined_markdown,
        "stage_index": 0,
        "parallel_workers": active_workers
    }
    
    report_file = report_generator.save_structured_report(host_section, report_data, timezone, report_dir, stage_name)
    if not report_file: 
        logging.error(f"[{host_section}] Failed to save report JSON. Rolling back state.")
        return False

    state_manager.save_last_run_timestamp(candidate_timestamp, host_section, test_mode)
    logging.info(f"[{host_section}] State committed. Log pointer updated to {candidate_timestamp}")

    # Send Email (Non-blocking)
    recipient_emails = stage_config.get('recipient_emails', '')
    if recipient_emails:
        email_subject = f"[{stage_name}] {hostname} - {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        smtp = get_smtp_config_for_stage(system_settings, host_config, host_section)
        if smtp:
            try:
                tpl_path = os.path.join(prompt_dir, '..', 'email_template.html')
                with open(tpl_path, 'r', encoding='utf-8') as f: tpl = f.read()
                body = tpl.format(
                    hostname=hostname, analysis_result=markdown.markdown(combined_markdown),
                    total_blocked=final_summary_stats.get("total_blocked_events", "0"),
                    top_ip="Mixed Sources",
                    critical_alerts=final_summary_stats.get("alerts_count", "0"),
                    start_time=start_time.strftime('%H:%M %d-%m'), end_time=end_time.strftime('%H:%M %d-%m')
                )
                atts = get_attachments(host_config, host_section, system_settings)
                diag = host_config.get(host_section, 'NetworkDiagram', fallback=None)
                email_service.send_email(host_section, email_subject, body, smtp, recipient_emails, diag, atts)
            except Exception as e: logging.error(f"Email failed: {e}")

    return True

def run_pipeline_stage_n(host_config, host_section, current_stage_idx, stage_config, prev_stage_config, api_key, system_settings, test_mode=False):

    stage_name = stage_config.get('name', f'Stage_{current_stage_idx}')
    prev_stage_name = prev_stage_config.get('name', f'Stage_{current_stage_idx-1}')
    threshold = int(stage_config.get('trigger_threshold', 10))
    
    logging.info(f"[{host_section}] >>> Checking trigger for Stage {current_stage_idx} ({stage_name}). Need {threshold} reports from {prev_stage_name}.")

    # Check buffer
    report_dir = system_settings.get('System', 'report_directory', fallback='reports')
    host_report_dir = os.path.join(report_dir, host_section)
    
    prev_stage_slug = report_generator.slugify(prev_stage_name)
    search_pattern = os.path.join(host_report_dir, prev_stage_slug, "*", "*.json")
 
    all_prev_reports = sorted(glob.glob(search_pattern, recursive=True), key=os.path.getmtime, reverse=False)
    
    reports_to_process = all_prev_reports[:threshold]
    
    if len(reports_to_process) < threshold and not test_mode:
        logging.info(f"[{host_section}] Not enough reports ({len(reports_to_process)}/{threshold}). Waiting.")
        return False
        
    if not reports_to_process:
        logging.warning(f"[{host_section}] No reports found to aggregate.")
        return False

    logging.info(f"[{host_section}] Aggregating {len(reports_to_process)} reports for {stage_name}.")

    combined_analysis, start_time, end_time = [], None, None
    # // Loop xuoi dong thoi gian
    for path in reports_to_process:
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                combined_analysis.append(f"--- REPORT ({data['analysis_start_time']} -> {data['analysis_end_time']}) ---\n{data['analysis_details_markdown']}")
                
                st = datetime.fromisoformat(data['analysis_start_time'])
                et = datetime.fromisoformat(data['analysis_end_time'])
                if not start_time or st < start_time: start_time = st
                if not end_time or et > end_time: end_time = et
        except: pass
        
    prompt_file = os.path.join(system_settings.get('System', 'prompt_directory', fallback='prompts'), stage_config.get('prompt_file', 'summary_prompt_template.md'))
    model_name = stage_config.get('model', 'gemini-2.5-flash-lite')
    hostname = host_config.get(host_section, 'SysHostname')
    timezone = host_config.get(host_section, 'TimeZone')

    content_to_analyze = "\n\n".join(combined_analysis)
    bonus_context = context_loader.read_bonus_context_files(host_config, host_section)
    
    result_raw = gemini_analyzer.analyze_with_gemini(host_section, content_to_analyze, bonus_context, api_key, prompt_file, model_name)
    
    # // Check fail AI
    if "Gemini blocked response" in result_raw or "Fatal Gemini Error" in result_raw:
        logging.error(f"[{host_section}] Stage {current_stage_idx} AI Failed. Not saving.")
        return False

    stats = utils.extract_json_from_text(result_raw)
    result_md = re.sub(r'```json\s*.*?\s*```', '', result_raw, flags=re.DOTALL | re.IGNORECASE).strip()
    
    report_data = {
        "hostname": hostname, 
        "analysis_start_time": start_time.isoformat() if start_time else "N/A",
        "analysis_end_time": end_time.isoformat() if end_time else "N/A",
        "report_generated_time": datetime.now(pytz.timezone(timezone)).isoformat(),
        "summary_stats": stats, 
        "analysis_details_markdown": result_md,
        "source_reports": reports_to_process,
        "stage_index": current_stage_idx
    }
    
    report_file = report_generator.save_structured_report(host_section, report_data, timezone, report_dir, stage_name)
    

    recipients = stage_config.get('recipient_emails', '')
    if recipients:
        email_subject = f"[{stage_name}] {hostname} - {datetime.now().strftime('%Y-%m-%d')}"
        smtp = get_smtp_config_for_stage(system_settings, host_config, host_section)
        if smtp:
            try:
                tpl_path = os.path.join(system_settings.get('System', 'prompt_directory'), '..', 'summary_email_template.html')
                if not os.path.exists(tpl_path): tpl_path = os.path.join(system_settings.get('System', 'prompt_directory'), '..', 'email_template.html')
                
                with open(tpl_path, 'r', encoding='utf-8') as f: tpl = f.read()
                
                issue = stats.get("most_frequent_issue") or stats.get("key_strategic_recommendation") or "N/A"
                blocked = stats.get("total_blocked_events_period") or stats.get("total_critical_events_final") or "N/A"
                
                body = tpl.format(
                    hostname=hostname, analysis_result=markdown.markdown(result_md),
                    total_blocked=blocked, top_issue=issue, critical_alerts="N/A",
                    start_time=start_time.strftime('%d-%m') if start_time else "?", 
                    end_time=end_time.strftime('%d-%m') if end_time else "?"
                )
                atts = reports_to_process 
                diag = host_config.get(host_section, 'NetworkDiagram', fallback=None)
                email_service.send_email(host_section, email_subject, body, smtp, recipients, diag, atts)
            except Exception as e: logging.error(f"Email error {stage_name}: {e}")

    return True

# --- MAIN LOOP ---

def process_host_pipeline(host_config, host_section, system_settings, test_mode=False):

    pipeline_json = host_config.get(host_section, 'pipeline_config', fallback='[]')
    try:
        pipeline = json.loads(pipeline_json)
    except:
        logging.error(f"[{host_section}] Invalid pipeline config.")
        return

    if not pipeline:
        logging.warning(f"[{host_section}] Empty pipeline.")
        return
        
    raw_api_key = host_config.get(host_section, 'GeminiAPIKey', fallback='')
    if not raw_api_key or "YOUR_API_KEY" in raw_api_key: return

    # // Resolve API Key (check if it's a profile)
    api_key = resolve_api_key(raw_api_key, system_settings)

    now = datetime.now()
    
    stage0_config = pipeline[0]
    if stage0_config.get('enabled', True):
        run_interval = host_config.getint(host_section, 'run_interval_seconds', fallback=3600)
        last_run = state_manager.get_last_cycle_run_timestamp(host_section, test_mode)
        
        should_run_stage0 = False
        if not last_run: should_run_stage0 = True
        elif (now - last_run).total_seconds() >= run_interval: should_run_stage0 = True
        
        if should_run_stage0:
            success = run_pipeline_stage_0(host_config, host_section, stage0_config, api_key, system_settings, test_mode)
            
            # // Chi update cycle run neu success
            if success:
                state_manager.save_last_cycle_run_timestamp(now, host_section, test_mode)
                if len(pipeline) > 1:
                    curr_buff = state_manager.get_stage_buffer_count(host_section, 1, test_mode)
                    state_manager.save_stage_buffer_count(host_section, 1, curr_buff + 1, test_mode)
                    logging.info(f"[{host_section}] Stage 0 Success. Stage 1 buffer: {curr_buff+1}")
            else:
                logging.warning(f"[{host_section}] Stage 0 Failed or Skipped. Will retry next cycle.")

    for i in range(1, len(pipeline)):
        current_stage = pipeline[i]
        if not current_stage.get('enabled', True): continue
        
        prev_stage = pipeline[i-1]
        
        threshold = int(current_stage.get('trigger_threshold', 10))
        current_buffer = state_manager.get_stage_buffer_count(host_section, i, test_mode)
        
        if current_buffer >= threshold:
            logging.info(f"[{host_section}] Triggering Stage {i} ({current_stage['name']}). Buffer {current_buffer} >= {threshold}")
            
            success = run_pipeline_stage_n(host_config, host_section, i, current_stage, prev_stage, api_key, system_settings, test_mode)
            
            if success:
                state_manager.save_stage_buffer_count(host_section, i, 0, test_mode)
                
                if i + 1 < len(pipeline):
                    next_buff = state_manager.get_stage_buffer_count(host_section, i+1, test_mode)
                    state_manager.save_stage_buffer_count(host_section, i+1, next_buff + 1, test_mode)
                    logging.info(f"[{host_section}] Stage {i} Success. Stage {i+1} buffer: {next_buff+1}")


def main():
    while True:
        try:
            sys_conf = configparser.ConfigParser(interpolation=None); sys_conf.read(SYSTEM_SETTINGS_FILE)
            host_conf = configparser.ConfigParser(interpolation=None); host_conf.read(CONFIG_FILE)
            
            for sec in [s for s in host_conf.sections() if s.startswith(('Firewall_', 'Host_'))]:
                if host_conf.getboolean(sec, 'enabled', fallback=True):
                    process_host_pipeline(host_conf, sec, sys_conf)
                    
            sleep_time = sys_conf.getint('System', 'scheduler_check_interval_seconds', fallback=60)
            logging.info(f"Scheduler sleeping {sleep_time}s...")
            time.sleep(sleep_time)
            
        except Exception as e:
            logging.error(f"Main Loop Error: {e}", exc_info=True)
            time.sleep(60)

if __name__ == "__main__":
    main()