import os
import logging
import time
import google.generativeai as genai
from google.api_core import exceptions as google_exceptions
from modules import state_manager

# // cau hinh retry
MAX_RETRIES = 3
INITIAL_BACKOFF = 2

def analyze_with_gemini(host_id, content, bonus_context, api_key, prompt_file, model_name):
    """Gui yeu cau phan tich toi Gemini voi co che Retry."""
    if not content or not content.strip():
        logging.warning(f"[{host_id}] Noi dung trong, bo qua phan tich.")
        return "Không có dữ liệu nào để phân tích trong khoảng thời gian được chọn."

    try:
        with open(prompt_file, 'r', encoding='utf-8') as f:
            prompt_template = f.read()
    except FileNotFoundError:
        logging.error(f"[{host_id}] Loi: Khong tim thay file template '{prompt_file}'.")
        return f"Lỗi hệ thống: Không tìm thấy file '{prompt_file}'."

    genai.configure(api_key=api_key)

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

    safety_settings = {
        'HARM_CATEGORY_HARASSMENT': 'BLOCK_NONE',
        'HARM_CATEGORY_HATE_SPEECH': 'BLOCK_NONE',
        'HARM_CATEGORY_SEXUALLY_EXPLICIT': 'BLOCK_NONE',
        'HARM_CATEGORY_DANGEROUS_CONTENT': 'BLOCK_NONE'
    }

    logging.info(f"[{host_id}] Su dung Gemini model: '{model_name}'")

    # // vong lap retry logic
    for attempt in range(MAX_RETRIES):
        try:
            if attempt > 0:
                logging.info(f"[{host_id}] Retry attempt {attempt+1}/{MAX_RETRIES}...")

            model = genai.GenerativeModel(model_name)
            request_options = {"timeout": 420}

            # // Tang counter API call truoc khi goi (hoac sau khi goi thanh cong)
            # // O day ta tang ngay khi goi de track usage thuc te
            state_manager.increment_total_api_calls()

            response = model.generate_content(
                prompt,
                request_options=request_options,
                safety_settings=safety_settings
            )

            if not response.parts:
                finish_reason = "UNKNOWN"
                if response.candidates and response.candidates[0].finish_reason:
                    finish_reason = response.candidates[0].finish_reason.name
                
                # // neu bi block thi ko retry lam gi
                error_message = f"Gemini blocked response. Reason: {finish_reason}"
                logging.error(f"[{host_id}] {error_message}")
                return error_message

            logging.info(f"[{host_id}] Nhan phan tich tu Gemini thanh cong.")
            return response.text

        except google_exceptions.ResourceExhausted:
            wait_time = INITIAL_BACKOFF * (10 ** attempt)
            logging.warning(f"[{host_id}] Quota exceeded (429). Waiting {wait_time}s...")
            time.sleep(wait_time)
            
        except (google_exceptions.ServiceUnavailable, google_exceptions.DeadlineExceeded) as e:
            wait_time = INITIAL_BACKOFF
            logging.warning(f"[{host_id}] Network/Service error: {e}. Retrying in {wait_time}s...")
            time.sleep(wait_time)
            
        except Exception as e:
            # // loi fatal nhu sai api key thi thoi dung retry
            logging.error(f"[{host_id}] Fatal Gemini Error: {e}")
            return f"Đã xảy ra lỗi không thể phục hồi khi gọi Gemini: {e}"

    return "Không thể nhận phân tích từ Gemini sau nhiều lần thử lại (Lỗi mạng hoặc Rate Limit)."