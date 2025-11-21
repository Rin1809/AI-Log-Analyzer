import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
import sys
import os
import configparser
import threading
import pytest
import json
import shutil
from datetime import datetime
import logging

# --- SETUP PATH ---
# Hack sys.path de import modules tu backend (thu muc cha)
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(CURRENT_DIR)
sys.path.append(BACKEND_DIR)

# // Import resolve_api_key to fix profile key issues
from main import run_pipeline_stage_0, run_pipeline_stage_n, resolve_api_key
from modules import state_manager, utils

# --- CONSTANTS ---
TEST_CONFIG_FILE = os.path.join(BACKEND_DIR, "test_assets", "test_config.ini")
TEST_SYS_SETTINGS = os.path.join(BACKEND_DIR, "system_settings_test.ini")
TEST_REPORTS_DIR = os.path.join(BACKEND_DIR, "test_reports")
TEST_STATE_DIR = os.path.join(BACKEND_DIR, "states", "test")

# --- LOGGING REDIRECT ---
class TextHandler(logging.Handler):
    def __init__(self, text_widget):
        super().__init__()
        self.text_widget = text_widget

    def emit(self, record):
        msg = self.format(record)
        def append():
            self.text_widget.configure(state='normal')
            self.text_widget.insert(tk.END, msg + '\n')
            self.text_widget.see(tk.END)
            self.text_widget.configure(state='disabled')
        self.text_widget.after(0, append)

class LogAnalyzerTesterApp:
    def __init__(self, root):
        self.root = root
        self.root.title("AI Log Analyzer - Test Suite & MapReduce GUI")
        self.root.geometry("1100x750")
        
        self.config = configparser.ConfigParser(interpolation=None)
        self.sys_config = configparser.ConfigParser(interpolation=None)
        self.selected_host = tk.StringVar()
        
        self.setup_ui()
        self.load_config()

    def setup_ui(self):
        # Main Layout
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)

        # Tabs
        notebook = ttk.Notebook(main_frame)
        notebook.pack(fill=tk.BOTH, expand=True)

        # TAB 1: Auto Suite (New Feature)
        self.tab_suite = ttk.Frame(notebook)
        notebook.add(self.tab_suite, text="Auto Test Suite")
        self.setup_suite_tab(self.tab_suite)

        # TAB 2: Map-Reduce Simulation (Manual)
        self.tab_sim = ttk.Frame(notebook)
        notebook.add(self.tab_sim, text="Manual Simulator")
        self.setup_sim_tab(self.tab_sim)

        # TAB 3: Unit Tests
        self.tab_unit = ttk.Frame(notebook)
        notebook.add(self.tab_unit, text="Unit Tests")
        self.setup_unit_tab(self.tab_unit)

        # Console Output (Shared)
        console_frame = ttk.LabelFrame(main_frame, text="Console Output", padding="5")
        console_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        
        self.console = scrolledtext.ScrolledText(console_frame, state='disabled', height=12, font=("Consolas", 9))
        self.console.pack(fill=tk.BOTH, expand=True)
        
        # Redirect logging
        handler = TextHandler(self.console)
        handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
        logging.getLogger().addHandler(handler)
        logging.getLogger().setLevel(logging.INFO)

    def setup_suite_tab(self, parent):
        # Layout: Left (Controls) - Right (Summary/Info)
        paned = ttk.PanedWindow(parent, orient=tk.HORIZONTAL)
        paned.pack(fill=tk.BOTH, expand=True, pady=5)

        left_frame = ttk.Frame(paned, padding=10)
        right_frame = ttk.Frame(paned, padding=10)
        paned.add(left_frame, weight=1)
        paned.add(right_frame, weight=2)

        # Host Selection
        ttk.Label(left_frame, text="Target Host(s):").pack(anchor="w")
        self.suite_host_list = tk.Listbox(left_frame, height=15, exportselection=False, selectmode=tk.SINGLE)
        self.suite_host_list.pack(fill=tk.X, pady=5)
        
        # Options
        self.clean_env_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(left_frame, text="Clean Env (Del Reports/States)", variable=self.clean_env_var).pack(anchor="w", pady=5)

        # Buttons
        ttk.Button(left_frame, text="RUN SELECTED HOST (Full Pipeline)", command=lambda: self.run_suite(target="selected")).pack(fill=tk.X, pady=5)
        ttk.Button(left_frame, text="RUN ALL HOSTS (Batch)", command=lambda: self.run_suite(target="all")).pack(fill=tk.X, pady=5)
        
        # Info
        ttk.Label(right_frame, text="Suite Logic Description:", font=("Arial", 10, "bold")).pack(anchor="w")
        info_text = (
            "1. Stage 0 (Raw Log): Runs log_reader & gemini_analyzer (Stage 0).\n"
            "2. Mock Trigger: Manually sets buffer count > threshold.\n"
            "3. Stage N (Summary): Trigger downstream stages immediately.\n"
            "4. Validation: Checks if JSON reports are generated.\n\n"
            "* This replicates the old 'tester.py' automated logic."
        )
        lbl = ttk.Label(right_frame, text=info_text, justify=tk.LEFT, wraplength=400)
        lbl.pack(anchor="w", pady=10)

    def setup_sim_tab(self, parent):
        # Layout similar to before
        paned = ttk.PanedWindow(parent, orient=tk.HORIZONTAL)
        paned.pack(fill=tk.BOTH, expand=True, pady=5)
        left_frame = ttk.Frame(paned, padding=5); paned.add(left_frame, weight=1)
        right_frame = ttk.Frame(paned, padding=5); paned.add(right_frame, weight=2)

        ttk.Label(left_frame, text="Select Host:").pack(anchor="w")
        self.host_listbox = tk.Listbox(left_frame, height=10, exportselection=False)
        self.host_listbox.pack(fill=tk.X, pady=5)
        self.host_listbox.bind('<<ListboxSelect>>', self.on_host_select)

        btn_frame = ttk.LabelFrame(left_frame, text="Manual Controls", padding=5)
        btn_frame.pack(fill=tk.X, pady=10)
        ttk.Button(btn_frame, text="Reset States", command=self.reset_states).pack(fill=tk.X, pady=2)
        ttk.Button(btn_frame, text="Reload Config", command=self.load_config).pack(fill=tk.X, pady=2)

        # Right Side
        gen_frame = ttk.LabelFrame(right_frame, text="1. Log Injection", padding=5)
        gen_frame.pack(fill=tk.X, pady=5)
        f1 = ttk.Frame(gen_frame); f1.pack(fill=tk.X)
        ttk.Label(f1, text="Lines:").pack(side=tk.LEFT)
        self.log_count_var = tk.StringVar(value="5000")
        ttk.Entry(f1, textvariable=self.log_count_var, width=10).pack(side=tk.LEFT, padx=5)
        ttk.Button(gen_frame, text="Inject Logs", command=self.generate_fake_logs).pack(fill=tk.X, pady=5)

        pipe_frame = ttk.LabelFrame(right_frame, text="2. Manual Pipeline Step-by-Step", padding=5)
        pipe_frame.pack(fill=tk.X, pady=5)
        ttk.Button(pipe_frame, text="Run Stage 0 Only", command=lambda: self.run_manual_stage(0)).pack(fill=tk.X, pady=5)
        
        f2 = ttk.Frame(pipe_frame); f2.pack(fill=tk.X, pady=5)
        ttk.Label(f2, text="Stage Index:").pack(side=tk.LEFT)
        self.stage_n_var = tk.StringVar(value="1")
        ttk.Entry(f2, textvariable=self.stage_n_var, width=5).pack(side=tk.LEFT, padx=5)
        self.force_trigger_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(f2, text="Force Trigger", variable=self.force_trigger_var).pack(side=tk.LEFT)
        ttk.Button(pipe_frame, text="Run Stage N Only", command=self.run_manual_stage_n).pack(fill=tk.X, pady=2)

    def setup_unit_tab(self, parent):
        ttk.Label(parent, text="Available Unit Tests:").pack(anchor="w", pady=5)
        self.test_listbox = tk.Listbox(parent, selectmode=tk.MULTIPLE, height=8)
        self.test_listbox.pack(fill=tk.BOTH, expand=True, padx=5)
        
        test_files = [f for f in os.listdir(CURRENT_DIR) if f.startswith("test_") and f.endswith(".py")]
        for f in test_files: self.test_listbox.insert(tk.END, f)

        ttk.Button(parent, text="Run Selected Tests (Pytest)", command=self.run_pytest).pack(pady=10)

    # --- LOGIC ---

    def load_config(self):
        self.host_listbox.delete(0, tk.END)
        self.suite_host_list.delete(0, tk.END)
        
        if os.path.exists(TEST_CONFIG_FILE):
            self.config.read(TEST_CONFIG_FILE, encoding='utf-8')
            hosts = [s for s in self.config.sections() if s.startswith(('Host_', 'Firewall_'))]
            for h in hosts:
                self.host_listbox.insert(tk.END, h)
                self.suite_host_list.insert(tk.END, h)
            logging.info(f"Loaded {len(hosts)} hosts from config.")
        else:
            logging.error(f"Config file missing: {TEST_CONFIG_FILE}")

        if os.path.exists(TEST_SYS_SETTINGS):
            self.sys_config.read(TEST_SYS_SETTINGS, encoding='utf-8')
            if 'System' not in self.sys_config: self.sys_config.add_section('System')
            self.sys_config['System']['report_directory'] = TEST_REPORTS_DIR
            os.makedirs(TEST_REPORTS_DIR, exist_ok=True)

    def on_host_select(self, event):
        selection = event.widget.curselection()
        if selection: self.selected_host.set(event.widget.get(selection[0]))

    # --- SUITE RUNNER LOGIC (THE OLD TESTER.PY SOUL) ---
    def clean_environment(self):
        logging.warning(">>> Cleaning up test environment (Reports & States)...")
        if os.path.exists(TEST_REPORTS_DIR):
            try: shutil.rmtree(TEST_REPORTS_DIR)
            except: pass
        if os.path.exists(TEST_STATE_DIR):
            try: shutil.rmtree(TEST_STATE_DIR)
            except: pass
        os.makedirs(TEST_REPORTS_DIR, exist_ok=True)
        os.makedirs(TEST_STATE_DIR, exist_ok=True)

    def run_suite(self, target="all"):
        hosts_to_run = []
        
        if target == "selected":
            sel = self.suite_host_list.curselection()
            if not sel: return messagebox.showwarning("Warning", "Select a host first!")
            hosts_to_run.append(self.suite_host_list.get(sel[0]))
        else:
            hosts_to_run = [s for s in self.config.sections() if s.startswith(('Host_', 'Firewall_'))]

        if not hosts_to_run: return messagebox.showerror("Error", "No hosts found to run.")

        # Run in thread to prevent UI freeze
        threading.Thread(target=self._suite_worker, args=(hosts_to_run,)).start()

    def _suite_worker(self, hosts):
        if self.clean_env_var.get():
            self.clean_environment()
            
        # RE-READ CONFIG TO GET LATEST SETTINGS
        self.config.read(TEST_CONFIG_FILE, encoding='utf-8')

        total = len(hosts)
        passed = 0
        failed = 0

        logging.info(f"=== STARTING SUITE: {total} HOSTS ===")

        for host in hosts:
            logging.info(f"--- TESTING HOST: {host} ---")
            
            # 0. Check Enabled
            if not self.config.getboolean(host, 'enabled', fallback=True):
                logging.info(f"Skipping disabled host: {host}")
                continue

            pipeline_json = self.config.get(host, 'pipeline_config', fallback='[]')
            try:
                pipeline = json.loads(pipeline_json)
            except:
                logging.error(f"Invalid pipeline config for {host}")
                failed += 1
                continue

            if not pipeline:
                logging.warning(f"Empty pipeline for {host}")
                continue

            raw_api_key = self.config.get(host, 'GeminiAPIKey', fallback='')
            # // Resolve key de xu ly truong hop profile:XXX
            api_key = resolve_api_key(raw_api_key, self.sys_config)

            host_failed = False

            # 1. RUN STAGE 0
            stage0_conf = pipeline[0]
            try:
                logging.info(f"Running Stage 0 ({stage0_conf.get('name')})...")
                s0_success = run_pipeline_stage_0(
                    self.config, host, stage0_conf, api_key, self.sys_config, test_mode=True
                )
                if not s0_success:
                    logging.error("Stage 0 FAILED. Aborting host.")
                    host_failed = True
                else:
                    logging.info("Stage 0 PASSED.")
            except Exception as e:
                logging.error(f"Exception Stage 0: {e}")
                host_failed = True

            # 2. RUN DOWNSTREAM STAGES (With Mock Trigger)
            if not host_failed:
                for i in range(1, len(pipeline)):
                    current = pipeline[i]
                    prev = pipeline[i-1]
                    stage_name = current.get('name', f'Stage {i}')
                    threshold = int(current.get('trigger_threshold', 1))

                    logging.info(f"Preparing {stage_name} (Mock Trigger)...")
                    
                    # HACK: Force Buffer Update
                    state_manager.save_stage_buffer_count(host, i, threshold + 1, test_mode=True)
                    
                    try:
                        sn_success = run_pipeline_stage_n(
                            self.config, host, i, current, prev, api_key, self.sys_config, test_mode=True
                        )
                        if sn_success:
                            logging.info(f"{stage_name} PASSED.")
                            # Reset buffer like main loop
                            state_manager.save_stage_buffer_count(host, i, 0, test_mode=True)
                        else:
                            logging.error(f"{stage_name} FAILED.")
                            host_failed = True
                            break
                    except Exception as e:
                        logging.error(f"Exception {stage_name}: {e}")
                        host_failed = True
                        break
            
            if host_failed: failed += 1
            else: passed += 1
            logging.info("-" * 30)

        logging.info(f"=== SUITE FINISHED ===")
        logging.info(f"PASSED: {passed} | FAILED: {failed}")
        messagebox.showinfo("Suite Finished", f"Run complete.\nPassed: {passed}\nFailed: {failed}")


    # --- MANUAL SIMULATION LOGIC ---
    def generate_fake_logs(self):
        host = self.selected_host.get()
        if not host: return
        try: count = int(self.log_count_var.get())
        except: return
        
        log_file = self.config.get(host, 'LogFile')
        if not os.path.isabs(log_file): log_file = os.path.join(BACKEND_DIR, log_file)
        
        def _gen():
            logging.info(f"Injecting {count} logs into {log_file}...")
            os.makedirs(os.path.dirname(log_file), exist_ok=True)
            now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            try:
                with open(log_file, 'a', encoding='utf-8') as f:
                    for i in range(count):
                        f.write(f"{now} pfsense filterlog: [TEST-GEN] Log line {i+1}\n")
                logging.info("Injection Done.")
            except Exception as e: logging.error(f"Gen failed: {e}")
        threading.Thread(target=_gen).start()

    def reset_states(self):
        host = self.selected_host.get()
        if host: 
            state_manager.reset_all_states(host, test_mode=True)
            logging.info(f"Reset states for {host}")

    def run_manual_stage(self, idx):
        host = self.selected_host.get()
        if not host: return

        # RELOAD CONFIG HERE to catch GUI changes
        self.config.read(TEST_CONFIG_FILE, encoding='utf-8')
        
        pipeline = json.loads(self.config.get(host, 'pipeline_config', fallback='[]'))
        if idx >= len(pipeline): return
        
        raw_api_key = self.config.get(host, 'GeminiAPIKey', fallback='')
        api_key = resolve_api_key(raw_api_key, self.sys_config)
        
        def _run():
            try:
                run_pipeline_stage_0(self.config, host, pipeline[idx], 
                                   api_key, self.sys_config, test_mode=True)
                logging.info("Manual Stage 0 Done.")
            except Exception as e: logging.error(f"Error: {e}")
        threading.Thread(target=_run).start()

    def run_manual_stage_n(self):
        host = self.selected_host.get()
        if not host: return
        try: idx = int(self.stage_n_var.get())
        except: return
        
        # RELOAD CONFIG HERE
        self.config.read(TEST_CONFIG_FILE, encoding='utf-8')

        pipeline = json.loads(self.config.get(host, 'pipeline_config', fallback='[]'))
        if idx >= len(pipeline) or idx < 1: return
        
        raw_api_key = self.config.get(host, 'GeminiAPIKey', fallback='')
        api_key = resolve_api_key(raw_api_key, self.sys_config)
        
        if self.force_trigger_var.get():
            threshold = int(pipeline[idx].get('trigger_threshold', 1))
            state_manager.save_stage_buffer_count(host, idx, threshold+1, test_mode=True)
            logging.info(f"Force trigger set for Stage {idx}")

        def _run():
            run_pipeline_stage_n(self.config, host, idx, pipeline[idx], pipeline[idx-1],
                               api_key, self.sys_config, test_mode=True)
            logging.info(f"Manual Stage {idx} Done.")
        threading.Thread(target=_run).start()

    def run_pytest(self):
        sel = self.test_listbox.curselection()
        if not sel: return
        files = [os.path.join(CURRENT_DIR, self.test_listbox.get(i)) for i in sel]
        threading.Thread(target=lambda: pytest.main(["-v", "-s"] + files)).start()

if __name__ == "__main__":
    root = tk.Tk()
    app = LogAnalyzerTesterApp(root)
    root.mainloop()