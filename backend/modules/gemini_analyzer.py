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

def analyze_with_gemini(host_id, content, bonus_context, api_key, prompt_file, model_name, key_alias="Unknown", test_mode=False):
    """
    Gui yeu cau phan tich toi Gemini.
    Added: key_alias & test_mode de tracking usage chinh xac.
    """
    if not content or not content.strip():
        logging.warning(f"[{host_id}] Noi dung trong, bo qua phan tich.")
        return "Không có dữ liệu nào để phân tích trong khoảng thời gian được chọn."

    try:
        with open(prompt_file, 'r', encoding='utf-8') as f:
            prompt_template = f.read()
    except FileNotFoundError:
        logging.error(f"[{host_id}] Loi: Khong tim thay file template '{prompt_file}'.")
        return f"Lỗi hệ thống: Không tìm thấy file '{prompt_file}'."

    prompt_filename = os.path.basename(prompt_file).lower()
    is_summary_or_final = 'summary' in prompt_filename

    try:
        if is_summary_or_final:
            prompt = prompt_template.format(reports_content=content, bonus_context=bonus_context)
        else:
            prompt = prompt_template.format(logs_content=content, bonus_context=bonus_context)
    except KeyError as e:
        logging.error(f"[{host_id}] Loi placeholder trong prompt '{prompt_file}'. Chi tiet: {e}")
        return f"Lỗi cấu hình: Placeholder không đúng trong file prompt '{prompt_file}'."

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

    for attempt in range(MAX_RETRIES):
        try:
            if attempt > 0:
                logging.info(f"[{host_id}] Retry attempt {attempt+1}/{MAX_RETRIES}...")

            text_response = ""

            if has_client_support:
                # --- MODERN MODE (THREAD SAFE) ---
                from google.generativeai import types
                client = genai.Client(api_key=api_key)
                
                # Tracking Usage voi Alias va Test Mode
                logging.info(f"[{host_id}] Counting API usage for alias: {key_alias}")
                state_manager.increment_api_usage(key_alias, test_mode)
                
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(safety_settings=safety_settings_modern)
                )
                
                if not response.text:
                     finish_reason = "UNKNOWN"
                     if response.candidates and response.candidates[0].finish_reason:
                        finish_reason = response.candidates[0].finish_reason.name
                     return f"Gemini blocked response. Reason: {finish_reason}"
                
                text_response = response.text

            else:
                # --- LEGACY MODE (LOCKED) ---
                with _LEGACY_GLOBAL_LOCK:
                    genai.configure(api_key=api_key)
                    model = genai.GenerativeModel(model_name)
                    
                    # Tracking Usage
                    logging.info(f"[{host_id}] Counting API usage for alias: {key_alias}")
                    state_manager.increment_api_usage(key_alias, test_mode)
                    
                    response = model.generate_content(
                        prompt,
                        safety_settings=safety_settings_legacy
                    )
                    
                    if not response.parts:
                        try:
                            if response.prompt_feedback and response.prompt_feedback.block_reason:
                                return f"Gemini blocked response. Reason: {response.prompt_feedback.block_reason}"
                        except: pass
                        return "Gemini blocked response (Empty response)."

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
            return f"Đã xảy ra lỗi không thể phục hồi khi gọi Gemini: {e}"

    return "Không thể nhận phân tích từ Gemini sau nhiều lần thử lại (Lỗi mạng hoặc Rate Limit)."