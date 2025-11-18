import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from email.mime.application import MIMEApplication

LOGO_FILE = "logo_novaon.png"

def send_email(firewall_id, subject, body_html, smtp_config, recipient_emails_str, network_diagram_path=None, attachment_paths=None):
    """Gui email bao cao, su dung thong tin tu mot profile SMTP cu the."""
    sender_email = smtp_config.get('sender_email')
    sender_password = smtp_config.get('sender_password')
    smtp_server = smtp_config.get('server')
    smtp_port = int(smtp_config.get('port'))
    
    if not all([sender_email, sender_password, smtp_server, smtp_port]):
        logging.error(f"[{firewall_id}] Thong tin SMTP khong day du. Huy gui email.")
        return

    recipient_emails_list = [email.strip() for email in recipient_emails_str.split(',') if email and email.strip()]
    if not recipient_emails_list:
        logging.error(f"[{firewall_id}] Khong co dia chi email nguoi nhan hop le. Huy gui email.")
        return

    recipient_emails_str_cleaned = ", ".join(recipient_emails_list)
    logging.info(f"[{firewall_id}] Chuan bi gui email den {recipient_emails_str_cleaned} qua server {smtp_server}...")

    msg = MIMEMultipart('mixed')
    msg['From'] = sender_email
    msg['To'] = recipient_emails_str_cleaned
    msg['Subject'] = subject

    msg_related = MIMEMultipart('related')

    # // logic nay de hien/an phan so do mang
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
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(sender_email, sender_password)
        server.sendmail(sender_email, recipient_emails_list, msg.as_string())
        server.quit()
        logging.info(f"[{firewall_id}] Email da duoc gui thanh cong!")
    except Exception as e:
        logging.error(f"[{firewall_id}] Loi khi gui email: {e}")