import os
import logging
import google.generativeai as genai
from google.api_core import exceptions as google_exceptions

def analyze_with_gemini(host_id, content, bonus_context, api_key, prompt_file, model_name):
    """Gui yeu cau phan tich toi Gemini."""
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
        logging.error(f"[{host_id}] Loi placeholder trong prompt '{prompt_file}'. Co the prompt dang mong doi placeholder khac. Chi tiet: {e}")
        return f"Lỗi cấu hình: Placeholder không đúng trong file prompt '{prompt_file}'."


    # safety filter cua gemini
    safety_settings = {
        'HARM_CATEGORY_HARASSMENT': 'BLOCK_NONE',
        'HARM_CATEGORY_HATE_SPEECH': 'BLOCK_NONE',
        'HARM_CATEGORY_SEXUALLY_EXPLICIT': 'BLOCK_NONE',
        'HARM_CATEGORY_DANGEROUS_CONTENT': 'BLOCK_NONE'
    }

    try:
        logging.info(f"[{host_id}] Su dung Gemini model: '{model_name}'")
        logging.info(f"[{host_id}] Gui yeu cau den Gemini (prompt: {prompt_file}, timeout 420 giay)...")
        model = genai.GenerativeModel(model_name)
        request_options = {"timeout": 420}

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
            logging.error(f"[{host_id}] {error_message}")
            return error_message

        logging.info(f"[{host_id}] Nhan phan tich tu Gemini thanh cong.")
        return response.text

    except google_exceptions.DeadlineExceeded:
        logging.error(f"[{host_id}] Loi: Yeu cau den Gemini bi het thoi gian cho (timeout).")
        return "Không thể nhận phân tích từ Gemini do hết thời gian chờ."
    except Exception as e:
        logging.error(f"[{host_id}] Loi khi giao tiep voi Gemini: {e}")
        return f"Đã xảy ra lỗi khi phân tích log với Gemini: {e}"