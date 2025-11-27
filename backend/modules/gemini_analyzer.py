
import os
import logging
import time
import threading
import google.generativeai as genai
from google.api_core import exceptions as google_exceptions
from modules import state_manager

# // cau hinh retry
MAX_RETRIES = 3
INITIAL_BACKOFF = 2

# // Lock toan cuc cho che do Legacy (thu vien cu)
_LEGACY_GLOBAL_LOCK = threading.Lock()

def _upload_and_wait_file(path, host_id):
    """Helper de upload file len Gemini va doi processing (neu can)."""
    try:
        logging.info(f"[{host_id}] Uploading file to Gemini: {os.path.basename(path)}...")
        uploaded_file = genai.upload_file(path)
        
        # Doi file san sang (quan trong voi PDF lon)
        while uploaded_file.state.name == "PROCESSING":
            logging.info(f"[{host_id}] Waiting for file processing...")
            time.sleep(2)
            uploaded_file = genai.get_file(uploaded_file.name)
            
        if uploaded_file.state.name == "FAILED":
            raise ValueError(f"File upload failed: {uploaded_file.state.name}")
            
        logging.info(f"[{host_id}] File uploaded: {uploaded_file.display_name} ({uploaded_file.uri})")
        return uploaded_file
    except Exception as e:
        logging.error(f"[{host_id}] Error uploading context file '{path}': {e}")
        return None

def analyze_with_gemini(host_id, content, bonus_context, api_key, prompt_file, model_name, key_alias="Unknown", test_mode=False, context_file_paths=None):
    """
    Gui yeu cau phan tich toi Gemini.
    Ho tro File API cho PDF/Images.
    """
    if not content or not content.strip():
        logging.warning(f"[{host_id}] Noi dung trong, bo qua phan tich.")
        return "Không có dữ liệu nào để phân tích trong khoảng thời gian được chọn."

    # 1. Chuan bi Prompt Text
    try:
        with open(prompt_file, 'r', encoding='utf-8') as f:
            prompt_template = f.read()
    except FileNotFoundError:
        logging.error(f"[{host_id}] Loi: Khong tim thay file template '{prompt_file}'.")
        return f"Fatal Gemini Error: Không tìm thấy file '{prompt_file}'."

    prompt_filename = os.path.basename(prompt_file).lower()
    is_summary_or_final = 'summary' in prompt_filename

    try:
        if is_summary_or_final:
            prompt_text = prompt_template.format(reports_content=content, bonus_context=bonus_context)
        else:
            prompt_text = prompt_template.format(logs_content=content, bonus_context=bonus_context)
    except KeyError as e:
        logging.error(f"[{host_id}] Loi placeholder trong prompt '{prompt_file}'. Chi tiet: {e}")
        return f"Fatal Gemini Error: Placeholder không đúng trong file prompt '{prompt_file}'."

    # // Kiem tra xem co phai ban moi (ho tro Client) hay khong
    has_client_support = hasattr(genai, 'Client')
    
    # // Safety settings
    safety_settings_modern = [
        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"}
    ]
    
    safety_settings_legacy = {
        'HARM_CATEGORY_HARASSMENT': 'BLOCK_NONE',
        'HARM_CATEGORY_HATE_SPEECH': 'BLOCK_NONE',
        'HARM_CATEGORY_SEXUALLY_EXPLICIT': 'BLOCK_NONE',
        'HARM_CATEGORY_DANGEROUS_CONTENT': 'BLOCK_NONE'
    }

    logging.info(f"[{host_id}] Su dung Gemini model: '{model_name}' (Mode: {'Modern/Parallel' if has_client_support else 'Legacy/Serialized'})")

    uploaded_files = []
    
    if context_file_paths:
        try:
            genai.configure(api_key=api_key)
            for path in context_file_paths:
                f_obj = _upload_and_wait_file(path, host_id)
                if f_obj:
                    uploaded_files.append(f_obj)
        except Exception as e:
            logging.error(f"[{host_id}] Loi cau hinh API Key de upload file: {e}")


    request_contents = [prompt_text]
    if uploaded_files:
        request_contents.extend(uploaded_files)

    for attempt in range(MAX_RETRIES):
        try:
            if attempt > 0:
                logging.info(f"[{host_id}] Retry attempt {attempt+1}/{MAX_RETRIES}...")

            text_response = ""

            if has_client_support:
                from google.generativeai import types
                client = genai.Client(api_key=api_key)
                
                logging.info(f"[{host_id}] Counting API usage for alias: {key_alias}")
                state_manager.increment_api_usage(key_alias, test_mode)
                
                response = client.models.generate_content(
                    model=model_name,
                    contents=request_contents,
                    config=types.GenerateContentConfig(safety_settings=safety_settings_modern)
                )
                
                # // FIX CRASH: Handle response.text accessor error safely
                try:
                    text_response = response.text
                except ValueError:
                    finish_reason = "UNKNOWN"
                    try:
                        # Safety check cho candidates
                        if hasattr(response, 'candidates') and response.candidates:
                            if hasattr(response.candidates[0], 'finish_reason'):
                                finish_reason = response.candidates[0].finish_reason.name
                    except: pass
                    
                    return f"Fatal Gemini Error: Gemini blocked response. Reason: {finish_reason}"
                
                if not text_response:
                     return f"Fatal Gemini Error: Empty response from Gemini."

            else:
                # --- LEGACY MODE (LOCKED) ---
                with _LEGACY_GLOBAL_LOCK:
                    genai.configure(api_key=api_key)
                    model = genai.GenerativeModel(model_name)
                    
                    # Tracking Usage
                    logging.info(f"[{host_id}] Counting API usage for alias: {key_alias}")
                    state_manager.increment_api_usage(key_alias, test_mode)
                    
                    response = model.generate_content(
                        request_contents,
                        safety_settings=safety_settings_legacy
                    )
                    
                    if not response.parts:
                        try:
                            if response.prompt_feedback and response.prompt_feedback.block_reason:
                                return f"Fatal Gemini Error: Gemini blocked response. Reason: {response.prompt_feedback.block_reason}"
                        except: pass
                        return "Fatal Gemini Error: Gemini blocked response (Empty response parts)."

                    text_response = response.text

            logging.info(f"[{host_id}] Nhan phan tich tu Gemini thanh cong.")
            return text_response

        except google_exceptions.ResourceExhausted:
            wait_time = INITIAL_BACKOFF * (10 ** attempt)
            logging.warning(f"[{host_id}] Quota exceeded (429). Waiting {wait_time}s...")
            time.sleep(wait_time)
            
        except (google_exceptions.ServiceUnavailable, google_exceptions.DeadlineExceeded) as e:
            wait_time = INITIAL_BACKOFF
            logging.warning(f"[{host_id}] Network/Service error: {e}. Retrying in {wait_time}s...")
            time.sleep(wait_time)
            
        except Exception as e:
            logging.error(f"[{host_id}] Fatal Gemini Error: {e}")
            return f"Fatal Gemini Error: {str(e)}"

    return "Fatal Gemini Error: Không thể nhận phân tích từ Gemini sau nhiều lần thử lại (Lỗi mạng hoặc Rate Limit)."
