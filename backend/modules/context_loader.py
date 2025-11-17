import os
import logging

def read_bonus_context_files(config, firewall_section):
    """Doc tat ca cac file boi canh duoc dinh nghia trong section cua firewall."""
    context_parts = []
    
    # // fix: Bo sung tat ca cac key cau hinh de tranh bi nham la file context
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

    if not context_keys:
        return "Không có thông tin bối cảnh bổ sung nào được cung cấp."

    for key in context_keys:
        file_path = config.get(firewall_section, key).strip()
        if not file_path: # Bo qua cac gia tri rong
            continue
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