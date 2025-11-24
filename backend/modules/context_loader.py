import os
import logging
import mimetypes

# Hỗ trợ các định dạng Gemini chấp nhận qua File API
SUPPORTED_BINARY_EXTENSIONS = {'.pdf', '.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif'}

def read_bonus_context_files(config, host_section):
    """
    Doc cac file boi canh.
    Tra ve tuple: (text_content_string, list_of_binary_file_paths)
    """
    text_context_parts = []
    binary_file_paths = []

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
    explicit_keys = [key for key in config.options(host_section) if key.startswith('context_file_')]
    
    all_keys = context_keys + explicit_keys

    if not all_keys:
        return "Không có thông tin bối cảnh bổ sung.", []

    for key in all_keys:
        raw_path = config.get(host_section, key).strip()
        if not raw_path: 
            continue
            
        if key == 'networkdiagram':
            continue

        if os.path.isabs(raw_path):
            file_path = raw_path
        else:
            file_path = os.path.join(backend_dir, raw_path)

        if os.path.exists(file_path):
            try:
                _, ext = os.path.splitext(file_path)
                ext = ext.lower()

                if ext in SUPPORTED_BINARY_EXTENSIONS:
                    # Logic cho file Binary (PDF, Image) -> Day vao list path
                    logging.info(f"[{host_section}] Phat hien file binary: '{file_path}'")
                    binary_file_paths.append(file_path)
                else:
                    # Logic cho file Text -> Doc noi dung
                    logging.info(f"[{host_section}] Dang doc file text context: '{file_path}'")
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                        file_name = os.path.basename(file_path)
                        text_context_parts.append(f"--- START OF FILE: {file_name} ---\n{content}\n--- END OF FILE: {file_name} ---")
            except Exception as e:
                logging.error(f"[{host_section}] Loi khi xu ly file '{file_path}': {e}")
        else:
            logging.warning(f"[{host_section}] File boi canh KHONG TON TAI tai: '{file_path}'")

    text_result = "\n\n".join(text_context_parts) if text_context_parts else "Không có thông tin văn bản bổ sung."
    return text_result, binary_file_paths