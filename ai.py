#!/usr/bin/env python3

import os
import smtplib
import logging
import configparser
import markdown
import pytz
import time
import json
import re
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from email.mime.application import MIMEApplication
import google.generativeai as genai
from google.api_core import exceptions as google_exceptions
import glob

# --- gia tri mac dinh/fallback ---
CONFIG_FILE = "config.ini"
PROMPT_TEMPLATE_FILE = "prompt_template.md"
SUMMARY_PROMPT_TEMPLATE_FILE = "summary_prompt_template.md"
FINAL_SUMMARY_PROMPT_TEMPLATE_FILE = "final_summary_prompt_template.md" # moi
EMAIL_TEMPLATE_FILE = "email_template.html"
SUMMARY_EMAIL_TEMPLATE_FILE = "summary_email_template.html"
FINAL_SUMMARY_EMAIL_TEMPLATE_FILE = "final_summary_email_template.html" # moi
LOGO_FILE = "logo_novaon.png"


LOGGING_FORMAT = '%(asctime)s - %(levelname)s - %(message)s'
logging.basicConfig(level=logging.INFO, format=LOGGING_FORMAT)

# --- Cac ham quan ly trang thai ---

def get_last_run_timestamp(firewall_id):
    """Doc timestamp tu file state danh rieng cho mot firewall."""
    state_file = f".last_run_timestamp_{firewall_id}"
    if os.path.exists(state_file):
        with open(state_file, 'r') as f:
            try:
                return datetime.fromisoformat(f.read().strip())
            except ValueError:
                return None
    return None

def save_last_run_timestamp(timestamp, firewall_id):
    """Luu timestamp vao file state danh rieng cho mot firewall."""
    state_file = f".last_run_timestamp_{firewall_id}"
    with open(state_file, 'w') as f:
        f.write(timestamp.isoformat())

def get_last_cycle_run_timestamp(firewall_id):
    """Doc timestamp cua lan chay chu ky phan tich cuoi cung."""
    state_file = f".last_cycle_run_{firewall_id}"
    if os.path.exists(state_file):
        with open(state_file, 'r') as f:
            try:
                return datetime.fromisoformat(f.read().strip())
            except ValueError:
                return None
    return None

def save_last_cycle_run_timestamp(timestamp, firewall_id):
    """Luu timestamp cua lan chay chu ky phan tich."""
    state_file = f".last_cycle_run_{firewall_id}"
    with open(state_file, 'w') as f:
        f.write(timestamp.isoformat())

def get_summary_count(firewall_id):
    """Lay so dem bao cao da chay cho mot firewall."""
    summary_count_file = f".summary_report_count_{firewall_id}"
    if not os.path.exists(summary_count_file):
        return 0
    try:
        with open(summary_count_file, 'r') as f:
            return int(f.read().strip())
    except (ValueError, FileNotFoundError):
        return 0

def save_summary_count(count, firewall_id):
    """Luu so dem cho mot firewall."""
    summary_count_file = f".summary_report_count_{firewall_id}"
    with open(summary_count_file, 'w') as f:
        f.write(str(count))

def get_final_summary_count(firewall_id):
    """Lay so dem bao cao TONG HOP da chay de chuan bi cho FINAL."""
    final_summary_count_file = f".final_summary_report_count_{firewall_id}"
    if not os.path.exists(final_summary_count_file):
        return 0
    try:
        with open(final_summary_count_file, 'r') as f:
            return int(f.read().strip())
    except (ValueError, FileNotFoundError):
        return 0

def save_final_summary_count(count, firewall_id):
    """Luu so dem bao cao TONG HOP cho mot firewall."""
    final_summary_count_file = f".final_summary_report_count_{firewall_id}"
    with open(final_summary_count_file, 'w') as f:
        f.write(str(count))


# --- Cac ham loi ---

def read_new_log_entries(file_path, hours, timezone_str, firewall_id):
    """Doc cac dong log moi tu mot file log cu the."""
    logging.info(f"[{firewall_id}] Bat dau doc log tu '{file_path}'.")
    try:
        tz = pytz.timezone(timezone_str)
        end_time = datetime.now(tz)
        last_run_time = get_last_run_timestamp(firewall_id)

        if last_run_time:
            start_time = last_run_time.astimezone(tz)
            logging.info(f"[{firewall_id}] Doc log ke tu lan chay cuoi: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        else:
            start_time = end_time - timedelta(hours=hours)
            logging.info(f"[{firewall_id}] Lan chay dau tien. Doc log trong vong {hours} gio qua.")

        new_entries = []
        latest_log_time = start_time
        current_year = end_time.year
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                try:
                    log_time_str = line[:15]
                    log_datetime_naive = datetime.strptime(f"{current_year} {log_time_str}", "%Y %b %d %H:%M:%S")
                    log_datetime_aware = tz.localize(log_datetime_naive)
                    if log_datetime_aware > end_time:
                        log_datetime_aware = log_datetime_aware.replace(year=current_year - 1)
                    if log_datetime_aware > start_time:
                        new_entries.append(line)
                        if log_datetime_aware > latest_log_time:
                            latest_log_time = log_datetime_aware
                except ValueError:
                    continue

        if new_entries:
            save_last_run_timestamp(latest_log_time, firewall_id)

        logging.info(f"[{firewall_id}] Tim thay {len(new_entries)} dong log moi.")
        return ("".join(new_entries), start_time, end_time)

    except FileNotFoundError:
        logging.error(f"[{firewall_id}] Loi: Khong tim thay file log tai '{file_path}'.")
        return (None, None, None)
    except Exception as e:
        logging.error(f"[{firewall_id}] Loi khong mong muon khi doc file: {e}")
        return (None, None, None)

def analyze_logs_with_gemini(firewall_id, content, bonus_context, api_key, prompt_file):
    """Gui yeu cau phan tich toi Gemini."""
    if not content or not content.strip():
        logging.warning(f"[{firewall_id}] Noi dung trong, bo qua phan tich.")
        return "Không có dữ liệu nào để phân tích trong khoảng thời gian được chọn."

    try:
        with open(prompt_file, 'r', encoding='utf-8') as f:
            prompt_template = f.read()
    except FileNotFoundError:
        logging.error(f"[{firewall_id}] Loi: Khong tim thay file template '{prompt_file}'.")
        return f"Lỗi hệ thống: Không tìm thấy file '{prompt_file}'."

    genai.configure(api_key=api_key)

    is_summary_prompt = 'summary' in os.path.basename(prompt_file).lower()
    if is_summary_prompt:
        prompt = prompt_template.format(reports_content=content, bonus_context=bonus_context)
    else:
        prompt = prompt_template.format(logs_content=content, bonus_context=bonus_context)

    # safety filter cua gemini
    safety_settings = {
        'HARM_CATEGORY_HARASSMENT': 'BLOCK_NONE',
        'HARM_CATEGORY_HATE_SPEECH': 'BLOCK_NONE',
        'HARM_CATEGORY_SEXUALLY_EXPLICIT': 'BLOCK_NONE',
        'HARM_CATEGORY_DANGEROUS_CONTENT': 'BLOCK_NONE'
    }

    try:
        logging.info(f"[{firewall_id}] Gui yeu cau den Gemini (prompt: {prompt_file}, timeout 360 giay)...")
        model = genai.GenerativeModel('gemini-2.5-flash')
        request_options = {"timeout": 360}

        response = model.generate_content(
            prompt,
            request_options=request_options,
            safety_settings=safety_settings
        )

        if not response.parts:
            finish_reason = "UNKNOWN"
            if response.candidates and response.candidates[0].finish_reason:
                finish_reason = response.candidates[0].finish_reason.name

            safety_ratings_info = "N/A"
            if response.candidates and response.candidates[0].safety_ratings:
                safety_ratings_info = ", ".join([f"{rating.category.name}: {rating.probability.name}" for rating in response.candidates[0].safety_ratings])

            error_message = f"Không thể nhận phân tích từ Gemini. Lý do: Phản hồi bị chặn hoặc trống. (Finish Reason: {finish_reason}, Safety Ratings: {safety_ratings_info})"
            logging.error(f"[{firewall_id}] {error_message}")
            return error_message

        logging.info(f"[{firewall_id}] Nhan phan tich tu Gemini thanh cong.")
        return response.text

    except google_exceptions.DeadlineExceeded:
        logging.error(f"[{firewall_id}] Loi: Yeu cau den Gemini bi het thoi gian cho (timeout).")
        return "Không thể nhận phân tích từ Gemini do hết thời gian chờ."
    except Exception as e:
        logging.error(f"[{firewall_id}] Loi khi giao tiep voi Gemini: {e}")
        return f"Đã xảy ra lỗi khi phân tích log với Gemini: {e}"

def send_email(firewall_id, subject, body_html, config, recipient_emails_str, attachment_paths=None):
    """Gui email bao cao, ho tro dinh kem file."""
    sender_email = config.get('Email', 'SenderEmail')
    sender_password = config.get('Email', 'SenderPassword')
    
    # MODIFIED: Loc ra cac email hop le va loai bo khoang trang thua
    recipient_emails_list = [email.strip() for email in recipient_emails_str.split(',') if email and email.strip()]

    # FIX: Kiem tra neu khong co nguoi nhan hop le thi dung lai
    if not recipient_emails_list:
        logging.error(f"[{firewall_id}] Khong co dia chi email nguoi nhan hop le nao duoc cau hinh. Huy gui email.")
        return

    # Chuyen danh sach email tro lai thanh chuoi cho header 'To'
    recipient_emails_str_cleaned = ", ".join(recipient_emails_list)
    
    logging.info(f"[{firewall_id}] Chuan bi gui email den {recipient_emails_str_cleaned}...")

    msg = MIMEMultipart('mixed')
    msg['From'] = sender_email
    msg['To'] = recipient_emails_str_cleaned
    msg['Subject'] = subject

    msg_related = MIMEMultipart('related')

    network_diagram_path = config.get(firewall_id, 'NetworkDiagram', fallback=None)
    if network_diagram_path and os.path.exists(network_diagram_path):
        body_html = body_html.replace('style="display: none;"', '')

    msg_related.attach(MIMEText(body_html, 'html'))

    try:
        with open(LOGO_FILE, 'rb') as f:
            img_logo = MIMEImage(f.read())
            img_logo.add_header('Content-ID', '<logo_novaon>')
            msg_related.attach(img_logo)
    except FileNotFoundError:
        logging.warning(f"[{firewall_id}] Khong tim thay file logo '{LOGO_FILE}'.")

    if network_diagram_path and os.path.exists(network_diagram_path):
        try:
            with open(network_diagram_path, 'rb') as f:
                img_diagram = MIMEImage(f.read())
                img_diagram.add_header('Content-ID', '<network_diagram>')
                msg_related.attach(img_diagram)
        except Exception as e:
            logging.error(f"[{firewall_id}] Loi khi nhung so do mang: {e}")

    msg.attach(msg_related)

    if attachment_paths:
        for file_path in attachment_paths:
            if os.path.exists(file_path):
                try:
                    with open(file_path, 'rb') as attachment:
                        part = MIMEApplication(attachment.read(), Name=os.path.basename(file_path))
                    part['Content-Disposition'] = f'attachment; filename="{os.path.basename(file_path)}"'
                    msg.attach(part)
                    logging.info(f"[{firewall_id}] Da dinh kem file: '{file_path}'")
                except Exception as e:
                    logging.error(f"[{firewall_id}] Loi khi dinh kem file '{file_path}': {e}")
            else:
                logging.warning(f"[{firewall_id}] File dinh kem '{file_path}' khong ton tai.")

    try:
        server = smtplib.SMTP(config.get('Email', 'SMTPServer'), config.getint('Email', 'SMTPPort'))
        server.starttls()
        server.login(sender_email, sender_password)
        server.sendmail(sender_email, recipient_emails_list, msg.as_string())
        server.quit()
        logging.info(f"[{firewall_id}] Email da duoc gui thanh cong!")
    except Exception as e:
        logging.error(f"[{firewall_id}] Loi khi gui email: {e}")

def read_bonus_context_files(config, firewall_section):
    """Doc tat ca cac file boi canh duoc dinh nghia trong section cua firewall."""
    context_parts = []
    
    # danh sach key cau hinh, khong phai file boi canh
    standard_keys = [
        'syshostname', 'logfile', 'hourstoanalyze', 'timezone', 
        'reportdirectory', 'recipientemails', 'run_interval_seconds',
        'geminiapikey', 'networkdiagram',
        'summary_enabled', 'reports_per_summary', 'summary_recipient_emails', 
        'prompt_file', 'summary_prompt_file',
        'final_summary_enabled', 'summaries_per_final_report', 'final_summary_recipient_emails',
        'final_summary_prompt_file'
    ]
    context_keys = [key for key in config.options(firewall_section) if key not in standard_keys]

    if not context_keys:
        return "Không có thông tin bối cảnh bổ sung nào được cung cấp."

    for key in context_keys:
        file_path = config.get(firewall_section, key).strip()
        if os.path.exists(file_path):
            try:
                logging.info(f"[{firewall_section}] Dang doc file boi canh: '{file_path}'")
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    file_name = os.path.basename(file_path)
                    context_parts.append(f"--- START OF FILE: {file_name} ---\n{content}\n--- END OF FILE: {file_name} ---")
            except Exception as e:
                logging.error(f"[{firewall_section}] Loi khi doc file boi canh '{file_path}': {e}")
        else:
            logging.warning(f"[{firewall_section}] File boi canh '{file_path}' khong ton tai. Bo qua.")

    return "\n\n".join(context_parts) if context_parts else "Không có thông tin bối cảnh bổ sung nào được cung cấp."

def save_structured_report(firewall_id, report_data, timezone_str, base_report_dir, report_level='periodic'):
    """Luu du lieu tho ra file JSON, co to chuc theo thu muc cap do."""
    try:
        tz = pytz.timezone(timezone_str)
        now = datetime.now(tz)
        
        date_folder = now.strftime('%Y-%m-%d')
        time_filename = now.strftime('%H-%M-%S') + '.json'
        
        # xac dinh thu muc luu tru
        if report_level == 'final':
            report_folder_path = os.path.join(base_report_dir, "final", date_folder)
        elif report_level == 'summary':
            report_folder_path = os.path.join(base_report_dir, "summary", date_folder)
        else: # periodic
             report_folder_path = os.path.join(base_report_dir, date_folder)

        os.makedirs(report_folder_path, exist_ok=True)
        
        report_file_path = os.path.join(report_folder_path, time_filename)

        with open(report_file_path, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, ensure_ascii=False, indent=4)
        logging.info(f"[{firewall_id}] Da luu bao cao JSON ({report_level}) vao: '{report_file_path}'")

    except Exception as e:
        logging.error(f"[{firewall_id}] Loi khi luu file JSON: {e}")

# --- Ham chu ky ---

def run_analysis_cycle(config, firewall_section, api_key):
    """Chay mot chu ky phan tich dinh ky cho mot firewall cu the."""
    logging.info(f"[{firewall_section}] Bat dau chu ky phan tich log.")

    log_file = config.get(firewall_section, 'LogFile')
    hours = config.getint(firewall_section, 'HoursToAnalyze')
    hostname = config.get(firewall_section, 'SysHostname')
    timezone = config.get(firewall_section, 'TimeZone')
    report_dir = config.get(firewall_section, 'ReportDirectory')
    recipient_emails = config.get(firewall_section, 'RecipientEmails')
    prompt_file = config.get(firewall_section, 'prompt_file', fallback=PROMPT_TEMPLATE_FILE)

    logs_content, start_time, end_time = read_new_log_entries(log_file, hours, timezone, firewall_section)
    if logs_content is None:
        logging.error(f"[{firewall_section}] Khong the tiep tuc do loi doc file log.")
        return

    bonus_context = read_bonus_context_files(config, firewall_section)
    analysis_raw = analyze_logs_with_gemini(firewall_section, logs_content, bonus_context, api_key, prompt_file)

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
        "summary_stats": summary_data, "analysis_details_markdown": analysis_markdown
    }
    save_structured_report(firewall_section, report_data, timezone, report_dir, report_level='periodic')

    email_subject = f"Báo cáo Log pfSense [{hostname}] - {datetime.now(pytz.timezone(timezone)).strftime('%Y-%m-%d %H:%M')}"
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
                'geminiapikey', 'networkdiagram',
                'summary_enabled', 'reports_per_summary', 'summary_recipient_emails', 
                'prompt_file', 'summary_prompt_file',
                'final_summary_enabled', 'summaries_per_final_report', 'final_summary_recipient_emails',
                'final_summary_prompt_file'
            ]
            context_keys = [key for key in config.options(firewall_section) if key not in standard_keys]
            attachments_to_send = [config.get(firewall_section, key) for key in context_keys]

        send_email(firewall_section, email_subject, email_body, config, recipient_emails, attachment_paths=attachments_to_send)
    except Exception as e:
        logging.error(f"[{firewall_section}] Loi khi tao/gui email: {e}")

    logging.info(f"[{firewall_section}] Hoan tat chu ky phan tich.")

def run_summary_analysis_cycle(config, firewall_section, api_key):
    """Chay mot chu ky phan tich TONG HOP cho mot firewall."""
    logging.info(f"[{firewall_section}] Bat dau chu ky phan tich TONG HOP.")

    reports_per_summary = config.getint(firewall_section, 'reports_per_summary')
    report_dir = config.get(firewall_section, 'ReportDirectory')
    timezone = config.get(firewall_section, 'TimeZone')
    hostname = config.get(firewall_section, 'SysHostname')
    recipient_emails = config.get(firewall_section, 'summary_recipient_emails')
    summary_prompt_file = config.get(firewall_section, 'summary_prompt_file', fallback=SUMMARY_PROMPT_TEMPLATE_FILE)

    # tim cac file bao cao dinh ky (khong nam trong /summary/ hoac /final/)
    report_files_pattern = os.path.join(report_dir, "*", "*.json")
    all_reports = sorted(glob.glob(report_files_pattern), key=os.path.getmtime, reverse=True)
    
    # loc ra cac bao cao khong phai la summary/final
    periodic_reports = [r for r in all_reports if "summary" not in r and "final" not in r]

    reports_to_summarize = periodic_reports[:reports_per_summary]
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
    bonus_context = read_bonus_context_files(config, firewall_section)
    summary_raw = analyze_logs_with_gemini(firewall_section, reports_content, bonus_context, api_key, summary_prompt_file)

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
    save_structured_report(firewall_section, report_data, timezone, report_dir, report_level='summary')

    email_subject = f"Báo cáo TỔNG HỢP Log pfSense [{hostname}] - {datetime.now(pytz.timezone(timezone)).strftime('%Y-%m-%d')}"
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
        send_email(firewall_section, email_subject, email_body, config, recipient_emails, attachment_paths=reports_to_summarize)
    except Exception as e:
        logging.error(f"[{firewall_section}] Loi khi tao/gui email tong hop: {e}")

    logging.info(f"[{firewall_section}] Hoan tat chu ky TONG HOP.")
    # tra ve True de kich hoat kiem tra final report
    return True

def run_final_summary_analysis_cycle(config, firewall_section, api_key):
    """Chay mot chu ky phan tich FINAL cho mot firewall."""
    logging.info(f"[{firewall_section}] Bat dau chu ky phan tich FINAL.")
    
    summaries_per_final = config.getint(firewall_section, 'summaries_per_final_report')
    report_dir = config.get(firewall_section, 'ReportDirectory')
    timezone = config.get(firewall_section, 'TimeZone')
    hostname = config.get(firewall_section, 'SysHostname')
    recipient_emails = config.get(firewall_section, 'final_summary_recipient_emails')
    final_prompt_file = config.get(firewall_section, 'final_summary_prompt_file', fallback=FINAL_SUMMARY_PROMPT_TEMPLATE_FILE)

    # tim cac file bao cao TONG HOP
    summary_files_pattern = os.path.join(report_dir, "summary", "*", "*.json")
    all_summary_reports = sorted(glob.glob(summary_files_pattern), key=os.path.getmtime, reverse=True)
    
    reports_to_finalize = all_summary_reports[:summaries_per_final]
    if not reports_to_finalize:
        logging.warning(f"[{firewall_section}] Khong tim thay file bao cao TONG HOP nao de tong hop FINAL.")
        return

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
        return

    reports_content = "\n\n".join(combined_analysis)
    bonus_context = read_bonus_context_files(config, firewall_section)
    final_raw = analyze_logs_with_gemini(firewall_section, reports_content, bonus_context, api_key, final_prompt_file)

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
    save_structured_report(firewall_section, report_data, timezone, report_dir, report_level='final')

    email_subject = f"Báo cáo CHIẾN LƯỢC Hệ thống pfSense [{hostname}] - {datetime.now(pytz.timezone(timezone)).strftime('%Y-%m-%d')}"
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
        send_email(firewall_section, email_subject, email_body, config, recipient_emails, attachment_paths=reports_to_finalize)
    except Exception as e:
        logging.error(f"[{firewall_section}] Loi khi tao/gui email FINAL: {e}")

    logging.info(f"[{firewall_section}] Hoan tat chu ky FINAL.")


def main():
    """
    Vong lap chinh cua chuong trinh.
    """
    while True:
        # FIX: Khoi tao ConfigParser voi trinh xu ly chu thich noi dong
        config = configparser.ConfigParser(interpolation=None, inline_comment_prefixes=';')
        
        if not os.path.exists(CONFIG_FILE):
            logging.error(f"Loi: File cau hinh '{CONFIG_FILE}' khong ton tai. Thoat.")
            return
        config.read(CONFIG_FILE)

        firewall_sections = [s for s in config.sections() if s.startswith('Firewall_')]
        
        if not firewall_sections:
            logging.warning("Khong tim thay section firewall nao (vi du: [Firewall_...]) trong config.ini.")
        else:
            now = datetime.now()
            logging.info(f"Scheduler: Thuc day luc {now.strftime('%Y-%m-%d %H:%M:%S')} de kiem tra lich.")

            for section in firewall_sections:
                run_interval = config.getint(section, 'run_interval_seconds', fallback=3600)
                last_run_time = get_last_cycle_run_timestamp(section)

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
                        # doc api key rieng cho firewall nay
                        gemini_api_key = config.get(section, 'GeminiAPIKey', fallback=None)
                        if not gemini_api_key or "YOUR_API_KEY" in gemini_api_key:
                            logging.error(f"[{section}] Loi: 'GeminiAPIKey' chua duoc thiet lap cho firewall nay. Bo qua.")
                            continue

                        # --- Chay bao cao dinh ky ---
                        run_analysis_cycle(config, section, gemini_api_key)
                        
                        # --- Kiem tra va chay bao cao tong hop ---
                        if config.getboolean(section, 'summary_enabled', fallback=False):
                            reports_per_summary = config.getint(section, 'reports_per_summary')
                            current_count = get_summary_count(section) + 1
                            
                            logging.info(f"[{section}] Dem bao cao tong hop: {current_count}/{reports_per_summary}")
                            
                            if current_count >= reports_per_summary:
                                logging.info(f"[{section}] Dat nguong, bat dau tao bao cao TONG HOP.")
                                summary_success = run_summary_analysis_cycle(config, section, gemini_api_key)
                                save_summary_count(0, section)
                                
                                # --- Kiem tra va chay bao cao FINAL (chi khi bao cao tong hop vua chay xong) ---
                                if summary_success and config.getboolean(section, 'final_summary_enabled', fallback=False):
                                    summaries_per_final = config.getint(section, 'summaries_per_final_report')
                                    final_current_count = get_final_summary_count(section) + 1
                                    
                                    logging.info(f"[{section}] Dem bao cao FINAL: {final_current_count}/{summaries_per_final}")

                                    if final_current_count >= summaries_per_final:
                                        logging.info(f"[{section}] Dat nguong, bat dau tao bao cao FINAL.")
                                        run_final_summary_analysis_cycle(config, section, gemini_api_key)
                                        save_final_summary_count(0, section)
                                    else:
                                        save_final_summary_count(final_current_count, section)

                            else:
                                save_summary_count(current_count, section)
                        else:
                            # reset dem neu summary bi tat
                            if os.path.exists(f".summary_report_count_{section}"):
                                save_summary_count(0, section)
                            if os.path.exists(f".final_summary_report_count_{section}"):
                                save_final_summary_count(0, section)
                        
                        # Ghi lai thoi gian chay thanh cong
                        save_last_cycle_run_timestamp(now, section)

                    except Exception as e:
                        logging.error(f"Loi nghiem trong khi xu ly firewall '{section}': {e}", exc_info=True)
                    
                    logging.info(f"--- KET THUC XU LY CHO FIREWALL: {section} ---")

        check_interval = config.getint('System', 'SchedulerCheckIntervalSeconds', fallback=60)
        logging.info(f"Scheduler: Da kiem tra xong. Se ngu trong {check_interval} giay.")
        time.sleep(check_interval)

if __name__ == "__main__":
    main()