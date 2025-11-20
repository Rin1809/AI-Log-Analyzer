import argparse
import configparser
import logging
import sys
import os
import json
import shutil
import time
from datetime import datetime

# Thêm đường dẫn để import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from main import run_pipeline_stage_0, run_pipeline_stage_n
from modules import state_manager

# Cấu hình logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Định nghĩa file cấu hình test
TEST_CONFIG_FILE = "test_assets/test_config.ini"
TEST_SYS_SETTINGS = "system_settings_test.ini"
TEST_REPORT_DIR = "test_reports"
TEST_STATE_DIR = "states/test"

# ANSI colors cho terminal đẹp hơn
class BColors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def clean_environment():
    """Dọn dẹp môi trường test: Xóa reports cũ và states cũ."""
    logger.info(f"{BColors.WARNING}>>> Cleaning up test environment...{BColors.ENDC}")
    
    # Xóa thư mục reports test
    if os.path.exists(TEST_REPORT_DIR):
        try:
            shutil.rmtree(TEST_REPORT_DIR)
            logger.info(f"Deleted {TEST_REPORT_DIR}")
        except Exception as e:
            logger.error(f"Failed to delete {TEST_REPORT_DIR}: {e}")

    # Xóa thư mục states test
    if os.path.exists(TEST_STATE_DIR):
        try:
            shutil.rmtree(TEST_STATE_DIR)
            logger.info(f"Deleted {TEST_STATE_DIR}")
        except Exception as e:
            logger.error(f"Failed to delete {TEST_STATE_DIR}: {e}")
            
    # Tạo lại thư mục trống
    os.makedirs(TEST_REPORT_DIR, exist_ok=True)
    os.makedirs(TEST_STATE_DIR, exist_ok=True)
    time.sleep(0.5) # Đợi file system sync

def print_result(stage_name, success):
    """In kết quả Pass/Fail."""
    if success:
        print(f"{BColors.OKGREEN}[PASS] {stage_name} completed successfully.{BColors.ENDC}")
    else:
        print(f"{BColors.FAIL}[FAIL] {stage_name} encountered errors.{BColors.ENDC}")

def run_full_suite():
    """Chạy toàn bộ kịch bản kiểm thử cho tất cả các host."""
    
    # 1. Load Config
    if not os.path.exists(TEST_CONFIG_FILE):
        logger.error(f"Config file not found: {TEST_CONFIG_FILE}")
        return

    host_conf = configparser.ConfigParser(interpolation=None)
    host_conf.read(TEST_CONFIG_FILE, encoding='utf-8')

    sys_conf = configparser.ConfigParser(interpolation=None)
    sys_conf.read(TEST_SYS_SETTINGS, encoding='utf-8')

    # Đảm bảo thư mục report trong system settings đúng là test_reports
    if 'System' not in sys_conf: sys_conf.add_section('System')
    sys_conf['System']['report_directory'] = TEST_REPORT_DIR

    hosts = [s for s in host_conf.sections() if s.startswith(('Firewall_', 'Host_'))]
    logger.info(f"{BColors.HEADER}Found {len(hosts)} hosts to test.{BColors.ENDC}\n")

    total_passed = 0
    total_failed = 0

    for host_section in hosts:
        if not host_conf.getboolean(host_section, 'enabled', fallback=True):
            logger.info(f"Skipping disabled host: {host_section}")
            continue

        print(f"{BColors.BOLD}=== TESTING HOST: {host_section} ==={BColors.ENDC}")
        
        # Lấy thông tin pipeline
        pipeline_json = host_conf.get(host_section, 'pipeline_config', fallback='[]')
        try:
            pipeline = json.loads(pipeline_json)
        except json.JSONDecodeError:
            logger.error(f"Invalid pipeline JSON for {host_section}")
            total_failed += 1
            continue

        if not pipeline:
            logger.warning("Empty pipeline.")
            continue

        api_key = host_conf.get(host_section, 'GeminiAPIKey', fallback='')
        
        # --- STEP 1: RUN STAGE 0 (RAW LOGS) ---
        stage0_name = pipeline[0].get('name', 'Stage 0')
        print(f"Running Stage 0: {stage0_name}...")
        
        try:
            success_s0 = run_pipeline_stage_0(
                host_conf, host_section, pipeline[0], api_key, sys_conf, test_mode=True
            )
            print_result(stage0_name, success_s0)
            
            if not success_s0:
                logger.error("Stage 0 failed. Aborting downstream stages for this host.")
                total_failed += 1
                continue
                
        except Exception as e:
            logger.error(f"Exception in Stage 0: {e}")
            print_result(stage0_name, False)
            total_failed += 1
            continue

        # --- STEP 2: RUN DOWNSTREAM STAGES (SUMMARY) ---
        # Logic: Loop qua các stage còn lại. 
        # Vấn đề: Stage sau cần "threshold" report từ stage trước.
        # Giải pháp: Hack "buffer count" và lợi dụng 'test_mode=True' trong logic main.py 
        # (để nó chạy dù chưa đủ file reports, chỉ cần buffer count trigger).

        previous_stage_success = True
        
        for i in range(1, len(pipeline)):
            current_stage = pipeline[i]
            prev_stage = pipeline[i-1]
            stage_name = current_stage.get('name', f'Stage {i}')
            threshold = int(current_stage.get('trigger_threshold', 1))

            print(f"Preparing {stage_name} (Threshold: {threshold})...")

            # !!! HACK: Force update buffer count để giả lập hệ thống đã chạy đủ lâu !!!
            # Ghi đè state file để đánh lừa logic check buffer
            state_manager.save_stage_buffer_count(host_section, i, threshold + 1, test_mode=True)
            logger.info(f"-> [Mock] Set buffer count for Stage {i} to {threshold + 1} (Trigger forced)")

            try:
                # Gọi hàm xử lý stage n
                success_sn = run_pipeline_stage_n(
                    host_conf, host_section, i, current_stage, prev_stage, api_key, sys_conf, test_mode=True
                )
                
                print_result(stage_name, success_sn)
                
                if not success_sn:
                    previous_stage_success = False
                    break
                    
            except Exception as e:
                logger.error(f"Exception in {stage_name}: {e}")
                print_result(stage_name, False)
                previous_stage_success = False
                break
        
        if previous_stage_success:
            total_passed += 1
        else:
            total_failed += 1
            
        print("-" * 40)

    # --- SUMMARY ---
    print(f"\n{BColors.HEADER}=== TEST SUITE SUMMARY ==={BColors.ENDC}")
    print(f"Total Hosts Tested: {len(hosts)}")
    print(f"{BColors.OKGREEN}Passed: {total_passed}{BColors.ENDC}")
    if total_failed > 0:
        print(f"{BColors.FAIL}Failed: {total_failed}{BColors.ENDC}")
    else:
        print(f"{BColors.OKBLUE}All systems operational.{BColors.ENDC}")

    # Check output files
    check_output_files()

def check_output_files():
    """Kiểm tra xem file json có thực sự được sinh ra không."""
    print(f"\n{BColors.BOLD}Checking generated artifacts in {TEST_REPORT_DIR}...{BColors.ENDC}")
    count = 0
    for root, dirs, files in os.walk(TEST_REPORT_DIR):
        for file in files:
            if file.endswith(".json"):
                count += 1
                # print(f" - Found report: {os.path.join(root, file)}")
    
    if count > 0:
        print(f"{BColors.OKGREEN}Found {count} JSON report files generated.{BColors.ENDC}")
    else:
        print(f"{BColors.FAIL}WARNING: No JSON reports found! Logic might be broken.{BColors.ENDC}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="End-to-End Tester for Log Analyzer")
    parser.add_argument('--no-clean', action='store_true', help="Don't clean previous reports/states")
    args = parser.parse_args()

    if not args.no_clean:
        clean_environment()
    
    run_full_suite()