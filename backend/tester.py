import argparse
import configparser
import logging
import sys
import os
import json

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from main import run_pipeline_stage_0, run_pipeline_stage_n
from modules.state_manager import reset_all_states, save_stage_buffer_count

logging.basicConfig(level=logging.INFO, format='%(message)s')

TEST_CONFIG = "test_assets/test_config.ini"
TEST_SYS = "system_settings_test.ini"

def run_test(host_section, stage_index, clean=False):
    host_conf = configparser.ConfigParser(interpolation=None); host_conf.read(TEST_CONFIG)
    sys_conf = configparser.ConfigParser(interpolation=None); sys_conf.read(TEST_SYS)
    
    if clean and stage_index <= 0: 
        reset_all_states(host_section, test_mode=True)
    
    pipeline_json = host_conf.get(host_section, 'pipeline_config', fallback='[]')
    try:
        pipeline = json.loads(pipeline_json)
    except:
        print(f"Invalid pipeline config for {host_section}")
        return

    if not pipeline: return print("No pipeline config found.")
    
    api_key = host_conf.get(host_section, 'GeminiAPIKey')
    
    if stage_index == 0:
        print(f"--- Running Stage 0: {pipeline[0]['name']} ---")
        run_pipeline_stage_0(host_conf, host_section, pipeline[0], api_key, sys_conf, test_mode=True)
        # Fake increment next buffer so next stage can run
        if len(pipeline) > 1:
            save_stage_buffer_count(host_section, 1, 999, test_mode=True) 
    
    elif stage_index > 0:
        if stage_index >= len(pipeline): return print(f"Stage index {stage_index} out of range.")
        print(f"--- Running Stage {stage_index}: {pipeline[stage_index]['name']} ---")
        
        run_pipeline_stage_n(host_conf, host_section, stage_index, pipeline[stage_index], pipeline[stage_index-1], api_key, sys_conf, test_mode=True)
        
        # Fake increment next buffer
        if stage_index + 1 < len(pipeline):
            save_stage_buffer_count(host_section, stage_index+1, 999, test_mode=True)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('stage_input', help="Stage Index (0, 1, 2...) or 'all'")
    parser.add_argument('--clean', action='store_true')
    args = parser.parse_args()
    
    # Parse input: 'all' -> -1, number -> int
    target_idx = -1
    if args.stage_input.lower() == 'all':
        target_idx = -1
    else:
        try:
            target_idx = int(args.stage_input)
        except ValueError:
            logging.error("Invalid argument. Use an integer (0, 1...) or 'all'.")
            sys.exit(1)
    
    conf = configparser.ConfigParser(); conf.read(TEST_CONFIG)
    hosts = [s for s in conf.sections() if s.startswith('Firewall_')]
    
    print(f"Found {len(hosts)} hosts. Target Stage: {'ALL' if target_idx == -1 else target_idx}")

    for h in hosts:
        if not conf.getboolean(h, 'enabled', fallback=True): continue
        
        print(f"\n=== TESTING HOST: {h} ===")
        
        if target_idx == -1:
            # Run chain: 0 -> 1 -> 2 ...
            # First run stage 0
            run_test(h, 0, args.clean)
            
            # Load pipeline to know how many stages
            try:
                pipeline = json.loads(conf.get(h, 'pipeline_config'))
                for i in range(1, len(pipeline)):
                    run_test(h, i, False) # Don't clean in middle of chain
            except: pass
        else:
            run_test(h, target_idx, args.clean)