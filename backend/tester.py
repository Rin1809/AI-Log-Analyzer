import os
import sys
import argparse
import configparser
import logging
import shutil
from datetime import datetime
import pytz

# a bit of magic to make modules importable
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from main import run_analysis_cycle, run_summary_analysis_cycle, run_final_summary_analysis_cycle
from modules.state_manager import reset_all_states

# --- config ---
LOGGING_FORMAT = '%(asctime)s - %(levelname)s - %(message)s'
logging.basicConfig(level=logging.INFO, format=LOGGING_FORMAT)

TEST_CONFIG_FILE = "test_assets/test_config.ini"

def setup_test_environment(config):
    """Prepares directories and resets states for ALL hosts before a test run."""
    firewall_sections = [s for s in config.sections() if s.startswith('Firewall_')]
    if not firewall_sections:
        logging.error(f"Khong tim thay section nao bat dau bang 'Firewall_' trong file '{TEST_CONFIG_FILE}'.")
        sys.exit(1)

    report_dir = config.get(firewall_sections[0], 'ReportDirectory')

    if os.path.exists(report_dir):
        shutil.rmtree(report_dir)
        logging.info(f"Da xoa toan bo thu muc test cu: {report_dir}")

    os.makedirs(report_dir, exist_ok=True)
    
    for section in firewall_sections:
        reset_all_states(section, test_mode=True)
    
    logging.info("Da reset toan bo state cho kịch bản test.")

def run_test_for_host(config, firewall_section, test_type):
    """Runs a specific test type for a single configured firewall host."""
    api_key = config.get(firewall_section, 'GeminiAPIKey')

    if not api_key or "YOUR_API_KEY" in api_key:
        logging.error(f"Vui long dien Gemini API key vao file '{TEST_CONFIG_FILE}' cho section [{firewall_section}]")
        return
    
    if test_type in ['periodic', 'summary', 'final', 'all']:
        logging.info(f"--- Bat dau kịch bản test [PERIODIC] cho [{firewall_section}] ---")
        run_analysis_cycle(config, firewall_section, api_key, test_mode=True)
        if test_type == 'periodic':
            return

    if test_type in ['summary', 'final', 'all']:
        # phai tao them 1 report periodic nua de du dieu kien chay summary
        logging.info(f"--- Tao them bao cao dinh ky de du dieu kien cho [SUMMARY] - Host: [{firewall_section}] ---")
        run_analysis_cycle(config, firewall_section, api_key, test_mode=True)
        
        logging.info(f"--- Bat dau kịch bản test [SUMMARY] cho [{firewall_section}] ---")
        summary_success = run_summary_analysis_cycle(config, firewall_section, api_key, test_mode=True)
        if test_type == 'summary':
            return
        
    if test_type in ['final', 'all']:
        if not summary_success:
             logging.error(f"Test [SUMMARY] that bai, khong the chay test [FINAL] cho host [{firewall_section}].")
             return

        logging.info(f"--- Bat dau kịch bản test [FINAL] cho [{firewall_section}] ---")
        run_final_summary_analysis_cycle(config, firewall_section, api_key, test_mode=True)
        if test_type == 'final':
             return


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Automation test script for pfsense-log-analyzer.")
    parser.add_argument(
        "test_type", 
        choices=['periodic', 'summary', 'final', 'all'], 
        help="Loai test can chay: 'periodic', 'summary', 'final', or 'all'."
    )
    args = parser.parse_args()

    logging.info(f"========== KHOI DONG KIEM THU CHUC NANG: {args.test_type.upper()} ==========")

    if not os.path.exists(TEST_CONFIG_FILE):
        logging.error(f"File cau hinh test '{TEST_CONFIG_FILE}' khong ton tai.")
        sys.exit(1)

    config = configparser.ConfigParser(interpolation=None)
    config.read(TEST_CONFIG_FILE)
    
    # // Don dep toan bo moi truong mot lan duy nhat
    setup_test_environment(config)
    
    firewall_sections = [s for s in config.sections() if s.startswith('Firewall_')]

    logging.info(f"Tim thay {len(firewall_sections)} host de test: {', '.join(firewall_sections)}")

    for section in firewall_sections:
        # // fix: Check trang thai enabled truoc khi chay bat ky test nao
        if not config.getboolean(section, 'enabled', fallback=True):
            logging.warning(f"Bo qua host [{section}] do dang bi tat (enabled=false).")
            continue

        logging.info(f"========== Bat dau xu ly cho host: [{section}] ==========")
        run_test_for_host(config, section, args.test_type)
        logging.info(f"========== Hoan tat xu ly cho host: [{section}] ==========\n")

    logging.info(f"========== KET THUC KIEM THU: {args.test_type.upper()} ==========")