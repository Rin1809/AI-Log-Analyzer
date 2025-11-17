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
from datetime import datetime

# import tu cac module da tach
from modules import state_manager
from modules import log_reader
from modules import gemini_analyzer
from modules import email_service
from modules import report_generator
from modules import context_loader

# --- gia tri mac dinh/fallback ---
CONFIG_FILE = "config.ini"
PROMPT_TEMPLATE_FILE = "prompts/prompt_template.md"
SUMMARY_PROMPT_TEMPLATE_FILE = "prompts/summary_prompt_template.md"
FINAL_SUMMARY_PROMPT_TEMPLATE_FILE = "prompts/final_summary_prompt_template.md"
EMAIL_TEMPLATE_FILE = "email_template.html"
SUMMARY_EMAIL_TEMPLATE_FILE = "summary_email_template.html"
FINAL_SUMMARY_EMAIL_TEMPLATE_FILE = "final_summary_email_template.html"

LOGGING_FORMAT = '%(asctime)s - %(levelname)s - %(message)s'
logging.basicConfig(level=logging.INFO, format=LOGGING_FORMAT)

# --- Ham chu ky ---

def run_analysis_cycle(config, firewall_section, api_key, test_mode=False):
    """Chay mot chu ky phan tich dinh ky cho mot firewall cu the."""
    logging.info(f"[{firewall_section}] Bat dau chu ky phan tich log.")

    log_file = config.get(firewall_section, 'LogFile')
    hours = config.getint(firewall_section, 'HoursToAnalyze')
    hostname = config.get(firewall_section, 'SysHostname')
    timezone = config.get(firewall_section, 'TimeZone')
    report_dir = config.get(firewall_section, 'ReportDirectory')
    recipient_emails = config.get(firewall_section, 'RecipientEmails')
    prompt_file = config.get(firewall_section, 'prompt_file', fallback=PROMPT_TEMPLATE_FILE)
    model_name = config.get(firewall_section, 'gemini_model', fallback='gemini-1.5-flash') 

    # // fix: Nhan them log_count
    logs_content, start_time, end_time, log_count = log_reader.read_new_log_entries(log_file, hours, timezone, firewall_section, test_mode)
    if logs_content is None:
        logging.error(f"[{firewall_section}] Khong the tiep tuc do loi doc file log.")
        return

    bonus_context = context_loader.read_bonus_context_files(config, firewall_section)
    analysis_raw = gemini_analyzer.analyze_with_gemini(firewall_section, logs_content, bonus_context, api_key, prompt_file, model_name) # pass model

    summary_data = {"total_blocked_events": "N/A", "top_blocked_source_ip": "N/A", "alerts_count": "N/A"}
    analysis_markdown = analysis_raw
    try:
        json_match = re.search(r'```json\n(.*?)\n```', analysis_raw, re.DOTALL)
        if json_match:
            summary_data = json.loads(json_match.group(1))
            analysis_markdown = analysis_raw.replace(json_match.group(0), "").strip()
    except Exception as e:
        logging.warning(f"[{firewall_section}] Khong the trich xuat JSON: {e}")

    report_data = {
        "hostname": hostname, "analysis_start_time": start_time.isoformat(), "analysis_end_time": end_time.isoformat(),
        "report_generated_time": datetime.now(pytz.timezone(timezone)).isoformat(),
        "raw_log_count": log_count, # // fix: Them so log goc vao report
        "summary_stats": summary_data, "analysis_details_markdown": analysis_markdown
    }
    report_generator.save_structured_report(firewall_section, report_data, timezone, report_dir, report_level='periodic')

    email_subject = f"Báo cáo Log [{hostname}] - {datetime.now(pytz.timezone(timezone)).strftime('%Y-%m-%d %H:%M')}"
    try:
        with open(EMAIL_TEMPLATE_FILE, 'r', encoding='utf-8') as f: email_template = f.read()
        analysis_html = markdown.markdown(analysis_markdown)
        email_body = email_template.format(
            hostname=hostname, analysis_result=analysis_html,
            total_blocked=summary_data.get("total_blocked_events", "N/A"),
            top_ip=summary_data.get("top_blocked_source_ip", "N/A"),
            critical_alerts=summary_data.get("alerts_count", "N/A"),
            start_time=start_time.strftime('%H:%M:%S %d-%m-%Y'),
            end_time=end_time.strftime('%H:%M:%S %d-%m-%Y')
        )

        attachments_to_send = []
        if config.getboolean('Attachments', 'AttachContextFiles', fallback=False):
            standard_keys = [
                'syshostname', 'logfile', 'hourstoanalyze', 'timezone', 
                'reportdirectory', 'recipientemails', 'run_interval_seconds',
                'geminiapikey', 'networkdiagram', 'enabled',
                'summary_enabled', 'reports_per_summary', 'summary_recipient_emails', 
                'prompt_file', 'summary_prompt_file',
                'final_summary_enabled', 'summaries_per_final_report', 'final_summary_recipient_emails',
                'final_summary_prompt_file',
                'gemini_model', 'summary_gemini_model', 'final_summary_model'
            ]
            context_keys = [key for key in config.options(firewall_section) if key not in standard_keys]
            attachments_to_send = [config.get(firewall_section, key) for key in context_keys if config.get(firewall_section, key).strip()]

        email_service.send_email(firewall_section, email_subject, email_body, config, recipient_emails, attachment_paths=attachments_to_send)
    except Exception as e:
        logging.error(f"[{firewall_section}] Loi khi tao/gui email: {e}")

    logging.info(f"[{firewall_section}] Hoan tat chu ky phan tich.")


def run_summary_analysis_cycle(config, firewall_section, api_key, test_mode=False):
    """Chay mot chu ky phan tich TONG HOP cho mot firewall."""
    logging.info(f"[{firewall_section}] Bat dau chu ky phan tich TONG HOP.")

    reports_per_summary = config.getint(firewall_section, 'reports_per_summary')
    report_dir = config.get(firewall_section, 'ReportDirectory')
    timezone = config.get(firewall_section, 'TimeZone')
    hostname = config.get(firewall_section, 'SysHostname')
    recipient_emails = config.get(firewall_section, 'summary_recipient_emails')
    summary_prompt_file = config.get(firewall_section, 'summary_prompt_file', fallback=SUMMARY_PROMPT_TEMPLATE_FILE)
    model_name = config.get(firewall_section, 'summary_gemini_model', fallback='gemini-1.5-flash') 

    host_report_dir = os.path.join(report_dir, firewall_section)
    report_files_pattern = os.path.join(host_report_dir, "periodic", "*", "*.json")
    all_reports = sorted(glob.glob(report_files_pattern, recursive=True), key=os.path.getmtime, reverse=True)
    
    reports_to_summarize = all_reports[:reports_per_summary]

    if len(reports_to_summarize) < reports_per_summary and not test_mode:
        logging.warning(f"[{firewall_section}] Khong du bao cao ({len(reports_to_summarize)}/{reports_per_summary}) de tong hop. Cho chu ky sau.")
        return False

    if not reports_to_summarize:
         logging.warning(f"[{firewall_section}] Khong tim thay file bao cao dinh ky nao de tong hop.")
         return False

    logging.info(f"[{firewall_section}] Se tong hop tu {len(reports_to_summarize)} bao cao: {reports_to_summarize}")

    combined_analysis, start_time, end_time = [], None, None
    for report_path in reversed(reports_to_summarize):
        try:
            with open(report_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                combined_analysis.append(f"--- BAO CAO TU {data['analysis_start_time']} DEN {data['analysis_end_time']} ---\n\n{data['analysis_details_markdown']}")

                s_time = datetime.fromisoformat(data['analysis_start_time'])
                e_time = datetime.fromisoformat(data['analysis_end_time'])
                if start_time is None or s_time < start_time: start_time = s_time
                if end_time is None or e_time > end_time: end_time = e_time
        except Exception as e:
            logging.error(f"[{firewall_section}] Loi khi doc file '{report_path}': {e}")

    if not combined_analysis:
        logging.error(f"[{firewall_section}] Khong the doc noi dung tu bat ky file nao.")
        return False

    reports_content = "\n\n".join(combined_analysis)
    bonus_context = context_loader.read_bonus_context_files(config, firewall_section)
    summary_raw = gemini_analyzer.analyze_with_gemini(firewall_section, reports_content, bonus_context, api_key, summary_prompt_file, model_name)

    summary_data = {"total_blocked_events_period": "N/A", "most_frequent_issue": "N/A", "total_alerts_period": "N/A"}
    analysis_markdown = summary_raw
    try:
        json_match = re.search(r'```json\n(.*?)\n```', summary_raw, re.DOTALL)
        if json_match:
            summary_data = json.loads(json_match.group(1))
            analysis_markdown = summary_raw.replace(json_match.group(0), "").strip()
    except Exception as e:
        logging.warning(f"[{firewall_section}] Khong the trich xuat JSON tong hop: {e}")

    report_data = {
        "hostname": hostname, "analysis_start_time": start_time.isoformat() if start_time else "N/A",
        "analysis_end_time": end_time.isoformat() if end_time else "N/A",
        "report_generated_time": datetime.now(pytz.timezone(timezone)).isoformat(),
        "summary_stats": summary_data, "analysis_details_markdown": analysis_markdown,
        "summarized_files": reports_to_summarize
    }
    report_generator.save_structured_report(firewall_section, report_data, timezone, report_dir, report_level='summary')

    email_subject = f"Báo cáo TỔNG HỢP Log [{hostname}] - {datetime.now(pytz.timezone(timezone)).strftime('%Y-%m-%d')}"
    try:
        with open(SUMMARY_EMAIL_TEMPLATE_FILE, 'r', encoding='utf-8') as f: email_template = f.read()
        analysis_html = markdown.markdown(analysis_markdown)
        email_body = email_template.format(
            hostname=hostname, analysis_result=analysis_html,
            total_blocked=summary_data.get("total_blocked_events_period", "N/A"),
            top_issue=summary_data.get("most_frequent_issue", "N/A"),
            critical_alerts=summary_data.get("total_alerts_period", "N/A"),
            start_time=start_time.strftime('%H:%M:%S %d-%m-%Y') if start_time else "N/A",
            end_time=end_time.strftime('%H:%M:%S %d-%m-%Y') if end_time else "N/A"
        )
        email_service.send_email(firewall_section, email_subject, email_body, config, recipient_emails, attachment_paths=reports_to_summarize)
    except Exception as e:
        logging.error(f"[{firewall_section}] Loi khi tao/gui email tong hop: {e}")

    logging.info(f"[{firewall_section}] Hoan tat chu ky TONG HOP.")
    return True

def run_final_summary_analysis_cycle(config, firewall_section, api_key, test_mode=False):
    """Chay mot chu ky phan tich FINAL cho mot firewall."""
    logging.info(f"[{firewall_section}] Bat dau chu ky phan tich FINAL.")
    
    summaries_per_final = config.getint(firewall_section, 'summaries_per_final_report')
    report_dir = config.get(firewall_section, 'ReportDirectory')
    timezone = config.get(firewall_section, 'TimeZone')
    hostname = config.get(firewall_section, 'SysHostname')
    recipient_emails = config.get(firewall_section, 'final_summary_recipient_emails')
    final_prompt_file = config.get(firewall_section, 'final_summary_prompt_file', fallback=FINAL_SUMMARY_PROMPT_TEMPLATE_FILE)
    model_name = config.get(firewall_section, 'final_summary_model', fallback='gemini-1.5-pro')

    host_report_dir = os.path.join(report_dir, firewall_section)
    summary_files_pattern = os.path.join(host_report_dir, "summary", "*", "*.json")
    all_summary_reports = sorted(glob.glob(summary_files_pattern, recursive=True), key=os.path.getmtime, reverse=True)
    
    reports_to_finalize = all_summary_reports[:summaries_per_final]

    if len(reports_to_finalize) < summaries_per_final and not test_mode:
        logging.warning(f"[{firewall_section}] Khong du bao cao TONG HOP ({len(reports_to_finalize)}/{summaries_per_final}) de tao bao cao FINAL.")
        return False
        
    if not reports_to_finalize:
        logging.warning(f"[{firewall_section}] Khong tim thay file bao cao TONG HOP nao de tong hop FINAL.")
        return False

    logging.info(f"[{firewall_section}] Se tong hop FINAL tu {len(reports_to_finalize)} bao cao TONG HOP: {reports_to_finalize}")

    combined_analysis, start_time, end_time = [], None, None
    for report_path in reversed(reports_to_finalize):
        try:
            with open(report_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                combined_analysis.append(f"--- BAO CAO TONG HOP TU {data['analysis_start_time']} DEN {data['analysis_end_time']} ---\n\n{data['analysis_details_markdown']}")
                
                s_time = datetime.fromisoformat(data['analysis_start_time'])
                e_time = datetime.fromisoformat(data['analysis_end_time'])
                if start_time is None or s_time < start_time: start_time = s_time
                if end_time is None or e_time > end_time: end_time = e_time
        except Exception as e:
            logging.error(f"[{firewall_section}] Loi khi doc file TONG HOP '{report_path}': {e}")

    if not combined_analysis:
        logging.error(f"[{firewall_section}] Khong the doc noi dung tu bat ky file TONG HOP nao.")
        return False

    reports_content = "\n\n".join(combined_analysis)
    bonus_context = context_loader.read_bonus_context_files(config, firewall_section)
    final_raw = gemini_analyzer.analyze_with_gemini(firewall_section, reports_content, bonus_context, api_key, final_prompt_file, model_name)

    summary_data = {"overall_security_trend": "N/A", "key_strategic_recommendation": "N/A", "total_critical_events_final": "N/A"}
    analysis_markdown = final_raw
    try:
        json_match = re.search(r'```json\n(.*?)\n```', final_raw, re.DOTALL)
        if json_match:
            summary_data = json.loads(json_match.group(1))
            analysis_markdown = final_raw.replace(json_match.group(0), "").strip()
    except Exception as e:
        logging.warning(f"[{firewall_section}] Khong the trich xuat JSON FINAL: {e}")

    report_data = {
        "hostname": hostname, "analysis_start_time": start_time.isoformat() if start_time else "N/A",
        "analysis_end_time": end_time.isoformat() if end_time else "N/A",
        "report_generated_time": datetime.now(pytz.timezone(timezone)).isoformat(),
        "summary_stats": summary_data, "analysis_details_markdown": analysis_markdown,
        "summarized_files": reports_to_finalize
    }
    report_generator.save_structured_report(firewall_section, report_data, timezone, report_dir, report_level='final')

    email_subject = f"Báo cáo Hệ thống [{hostname}] - {datetime.now(pytz.timezone(timezone)).strftime('%Y-%m-%d')}"
    try:
        with open(FINAL_SUMMARY_EMAIL_TEMPLATE_FILE, 'r', encoding='utf-8') as f: email_template = f.read()
        analysis_html = markdown.markdown(analysis_markdown)
        email_body = email_template.format(
            hostname=hostname, analysis_result=analysis_html,
            security_trend=summary_data.get("overall_security_trend", "N/A"),
            key_recommendation=summary_data.get("key_strategic_recommendation", "N/A"),
            total_events=summary_data.get("total_critical_events_final", "N/A"),
            start_time=start_time.strftime('%H:%M:%S %d-%m-%Y') if start_time else "N/A",
            end_time=end_time.strftime('%H:%M:%S %d-%m-%Y') if end_time else "N/A"
        )
        email_service.send_email(firewall_section, email_subject, email_body, config, recipient_emails, attachment_paths=reports_to_finalize)
    except Exception as e:
        logging.error(f"[{firewall_section}] Loi khi tao/gui email FINAL: {e}")

    logging.info(f"[{firewall_section}] Hoan tat chu ky FINAL.")
    return True

def main():
    """Vong lap chinh cua chuong trinh."""
    while True:
        initial_config = configparser.ConfigParser(interpolation=None)
        
        if not os.path.exists(CONFIG_FILE):
            logging.error(f"Loi: File cau hinh '{CONFIG_FILE}' khong ton tai. Thoat.")
            return
        initial_config.read(CONFIG_FILE)

        firewall_sections = [s for s in initial_config.sections() if s.startswith('Firewall_')]
        
        if not firewall_sections:
            logging.warning("Khong tim thay section firewall nao (vi du: [Firewall_...]) trong config.ini.")
        else:
            now = datetime.now()
            logging.info(f"Scheduler: Thuc day luc {now.strftime('%Y-%m-%d %H:%M:%S')} de kiem tra lich.")

            for section in firewall_sections:
                config = configparser.ConfigParser(interpolation=None)
                config.read(CONFIG_FILE)

                if not config.getboolean(section, 'enabled', fallback=True):
                    logging.info(f"[{section}] Host dang o trang thai 'disabled'. Bo qua.")
                    continue

                run_interval = config.getint(section, 'run_interval_seconds', fallback=3600)
                last_run_time = state_manager.get_last_cycle_run_timestamp(section)

                should_run = False
                if last_run_time is None:
                    logging.info(f"[{section}] Chua co lich su chay, se thuc thi lan dau.")
                    should_run = True
                else:
                    elapsed_seconds = (now - last_run_time).total_seconds()
                    if elapsed_seconds >= run_interval:
                        logging.info(f"[{section}] Da den lich chay (da qua {int(elapsed_seconds)}/{run_interval} giay).")
                        should_run = True

                if should_run:
                    logging.info(f"--- BAT DAU XU LY CHO FIREWALL: {section} ---")
                    try:
                        gemini_api_key = config.get(section, 'GeminiAPIKey', fallback=None)
                        if not gemini_api_key or "YOUR_API_KEY" in gemini_api_key:
                            logging.error(f"[{section}] Loi: 'GeminiAPIKey' chua duoc thiet lap. Bo qua.")
                            continue

                        run_analysis_cycle(config, section, gemini_api_key)
                        
                        if config.getboolean(section, 'summary_enabled', fallback=False):
                            reports_per_summary = config.getint(section, 'reports_per_summary')
                            current_count = state_manager.get_summary_count(section) + 1
                            
                            logging.info(f"[{section}] Dem bao cao tong hop: {current_count}/{reports_per_summary}")
                            
                            if current_count >= reports_per_summary:
                                logging.info(f"[{section}] Dat nguong, bat dau tao bao cao TONG HOP.")
                                summary_success = run_summary_analysis_cycle(config, section, gemini_api_key)
                                state_manager.save_summary_count(0, section)
                                
                                if summary_success and config.getboolean(section, 'final_summary_enabled', fallback=False):
                                    summaries_per_final = config.getint(section, 'summaries_per_final_report')
                                    final_current_count = state_manager.get_final_summary_count(section) + 1
                                    
                                    logging.info(f"[{section}] Dem bao cao FINAL: {final_current_count}/{summaries_per_final}")

                                    if final_current_count >= summaries_per_final:
                                        logging.info(f"[{section}] Dat nguong, bat dau tao bao cao FINAL.")
                                        run_final_summary_analysis_cycle(config, section, gemini_api_key)
                                        state_manager.save_final_summary_count(0, section)
                                    else:
                                        state_manager.save_final_summary_count(final_current_count, section)
                            else:
                                state_manager.save_summary_count(current_count, section)
                        else:
                             if os.path.exists(f".summary_report_count_{section}"):
                                state_manager.save_summary_count(0, section)
                             if os.path.exists(f".final_summary_report_count_{section}"):
                                state_manager.save_final_summary_count(0, section)
                        
                        state_manager.save_last_cycle_run_timestamp(now, section)

                    except Exception as e:
                        logging.error(f"Loi nghiem trong khi xu ly firewall '{section}': {e}", exc_info=True)
                    
                    logging.info(f"--- KET THUC XU LY CHO FIREWALL: {section} ---")

        check_interval = initial_config.getint('System', 'SchedulerCheckIntervalSeconds', fallback=60)
        logging.info(f"Scheduler: Da kiem tra xong. Se ngu trong {check_interval} giay.")
        time.sleep(check_interval)

if __name__ == "__main__":
    main()