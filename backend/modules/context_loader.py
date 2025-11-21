import os
import logging

def read_bonus_context_files(config, host_section):
    """Doc tat ca cac file boi canh duoc dinh nghia trong section cua host."""
    context_parts = []
    

    current_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(current_dir)
    
    standard_keys = [
        'syshostname', 'logfile', 'hourstoanalyze', 'timezone', 
        'reportdirectory', 'recipientemails', 'run_interval_seconds',
        'geminiapikey', 'networkdiagram', 'enabled',
        'summary_enabled', 'reports_per_summary', 'summary_recipient_emails', 
        'prompt_file', 'summary_prompt_file',
        'final_summary_enabled', 'summaries_per_final_report', 'final_summary_recipient_emails',
        'final_summary_prompt_file',
        'gemini_model', 'summary_gemini_model', 'final_summary_model',
        'smtp_profile', 'pipeline_config', 'chunk_size', 'context_files'
    ]
    

    context_keys = [key for key in config.options(host_section) if key not in standard_keys and not key.startswith('context_file_')]
    
    # Them cac key context_file_X vao danh sach
    explicit_keys = [key for key in config.options(host_section) if key.startswith('context_file_')]
    
    all_keys = context_keys + explicit_keys

    if not all_keys:
        return "Không có thông tin bối cảnh bổ sung nào được cung cấp."

    for key in all_keys:
        raw_path = config.get(host_section, key).strip()
        if not raw_path: 
            continue
            
        # Double check: neu key la networkdiagram ma bi lot luoi thi bo qua
        if key == 'networkdiagram':
            continue

        if os.path.isabs(raw_path):
            file_path = raw_path
        else:
            # // Neu la tuong doi, noi vao backend_dir
            file_path = os.path.join(backend_dir, raw_path)

        if os.path.exists(file_path):
            try:
                logging.info(f"[{host_section}] Dang doc file boi canh: '{file_path}'")
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    file_name = os.path.basename(file_path)
                    context_parts.append(f"--- START OF FILE: {file_name} ---\n{content}\n--- END OF FILE: {file_name} ---")
            except Exception as e:
                logging.error(f"[{host_section}] Loi khi doc file boi canh '{file_path}': {e}")
        else:
            # // Log warning ro rang hon voi full path
            logging.warning(f"[{host_section}] File boi canh KHONG TON TAI tai: '{file_path}' (Raw config: '{raw_path}')")

    return "\n\n".join(context_parts) if context_parts else "Không có thông tin bối cảnh bổ sung nào được cung cấp."