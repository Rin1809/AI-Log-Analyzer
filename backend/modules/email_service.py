import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from email.mime.application import MIMEApplication


CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(CURRENT_DIR)

# // Fallback lists if config path is invalid or empty
POSSIBLE_LOGOS = [
    os.path.join(BACKEND_DIR, "logo_novaon.png"),
    os.path.join(BACKEND_DIR, "Bonus_context", "logo_novaon.png")
]

def get_logo_path(custom_path=None):
    """
    Resolve logo path. Priority:
    1. Custom path from settings
    2. Default fallback locations
    """
    if custom_path and os.path.exists(custom_path):
        return custom_path
        
    for path in POSSIBLE_LOGOS:
        if os.path.exists(path):
            return path
            
    # Return the first fallback even if not exist, for logging purposes
    return custom_path if custom_path else POSSIBLE_LOGOS[0]

def send_email(host_id, subject, body_html, smtp_config, recipient_emails_str, network_diagram_path=None, attachment_paths=None, logo_path=None):
    """Gui email bao cao, su dung thong tin tu mot profile SMTP cu the."""
    sender_email = smtp_config.get('sender_email')
    sender_password = smtp_config.get('sender_password')
    smtp_server = smtp_config.get('server')
    smtp_port = int(smtp_config.get('port'))
    
    if not all([sender_email, sender_password, smtp_server, smtp_port]):
        logging.error(f"[{host_id}] Thong tin SMTP khong day du. Huy gui email.")
        return

    recipient_emails_list = [email.strip() for email in recipient_emails_str.split(',') if email and email.strip()]
    if not recipient_emails_list:
        logging.error(f"[{host_id}] Khong co dia chi email nguoi nhan hop le. Huy gui email.")
        return

    recipient_emails_str_cleaned = ", ".join(recipient_emails_list)
    logging.info(f"[{host_id}] Chuan bi gui email den {recipient_emails_str_cleaned} qua server {smtp_server}...")

    msg = MIMEMultipart('mixed')
    msg['From'] = sender_email
    msg['To'] = recipient_emails_str_cleaned
    msg['Subject'] = subject

    msg_related = MIMEMultipart('related')

    # // Logic check path diagram
    final_diagram_path = None
    if network_diagram_path:
        if os.path.isabs(network_diagram_path):
            final_diagram_path = network_diagram_path
        else:
            final_diagram_path = os.path.join(BACKEND_DIR, network_diagram_path)

    if final_diagram_path and os.path.exists(final_diagram_path):
        body_html = body_html.replace('style="display: none;"', '')
    else:
        # // Log neu config co diagram ma ko tim thay file
        if network_diagram_path:
            logging.warning(f"[{host_id}] Khong tim thay Network Diagram tai: '{final_diagram_path}'")

    msg_related.attach(MIMEText(body_html, 'html'))

    # // Dinh kem Logo (CID: logo_novaon)
    final_logo_path = get_logo_path(logo_path)
    
    try:
        if os.path.exists(final_logo_path):
            with open(final_logo_path, 'rb') as f:
                img_logo = MIMEImage(f.read())
                img_logo.add_header('Content-ID', '<logo_novaon>')
                img_logo.add_header('Content-Disposition', 'inline; filename="logo_novaon.png"')
                msg_related.attach(img_logo)
        else:
            logging.warning(f"[{host_id}] Khong tim thay file logo tai: '{final_logo_path}'")
    except Exception as e:
        logging.warning(f"[{host_id}] Loi khi doc file logo: {e}")

    # // Dinh kem So do mang (CID: network_diagram)
    if final_diagram_path and os.path.exists(final_diagram_path):
        try:
            with open(final_diagram_path, 'rb') as f:
                img_diagram = MIMEImage(f.read())
                img_diagram.add_header('Content-ID', '<network_diagram>')
                img_diagram.add_header('Content-Disposition', f'inline; filename="{os.path.basename(final_diagram_path)}"')
                msg_related.attach(img_diagram)
        except Exception as e:
            logging.error(f"[{host_id}] Loi khi nhung so do mang: {e}")

    msg.attach(msg_related)

    # // Dinh kem cac file bao cao (JSON, PDF, etc.)
    if attachment_paths:
        for raw_path in attachment_paths:
            # Fix path attachments
            if os.path.isabs(raw_path):
                file_path = raw_path
            else:
                file_path = os.path.join(BACKEND_DIR, raw_path)

            if os.path.exists(file_path):
                try:
                    with open(file_path, 'rb') as attachment:
                        part = MIMEApplication(attachment.read(), Name=os.path.basename(file_path))
                    part['Content-Disposition'] = f'attachment; filename="{os.path.basename(file_path)}"'
                    msg.attach(part)
                    logging.info(f"[{host_id}] Da dinh kem file: '{file_path}'")
                except Exception as e:
                    logging.error(f"[{host_id}] Loi khi dinh kem file '{file_path}': {e}")
            else:
                logging.warning(f"[{host_id}] File dinh kem '{file_path}' khong ton tai.")

    # // Thuc hien gui
    try:
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(sender_email, sender_password)
        server.sendmail(sender_email, recipient_emails_list, msg.as_string())
        server.quit()
        logging.info(f"[{host_id}] Email da duoc gui thanh cong!")
    except Exception as e:
        logging.error(f"[{host_id}] Loi khi gui email: {e}")