import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
import sys
import os
import configparser
import threading
import json
import shutil
from datetime import datetime
import logging

# --- SETUP PATH ---
# // Hack sys.path de import modules tu backend (thu muc cha)
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(CURRENT_DIR)
sys.path.append(BACKEND_DIR)

# // Import logic cot loi tu main app
from main import run_pipeline_stage_0, run_pipeline_stage_n, resolve_api_key
from modules import state_manager, utils

# --- CONSTANTS ---
TEST_CONFIG_FILE = os.path.join(BACKEND_DIR, "test_assets", "test_config.ini")
TEST_SYS_SETTINGS = os.path.join(BACKEND_DIR, "system_settings_test.ini")
TEST_REPORTS_DIR = os.path.join(BACKEND_DIR, "test_reports")
TEST_STATE_DIR = os.path.join(BACKEND_DIR, "states", "test")

# --- LOGGING REDIRECT ---
class TextHandler(logging.Handler):
    """Redirect logging vao widget Text cua Tkinter."""
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
        self.root.title("AI Log Analyzer - Senior Dev Test Suite")
        self.root.geometry("1200x800")
        
        self.config = configparser.ConfigParser(interpolation=None)
        self.sys_config = configparser.ConfigParser(interpolation=None)
        self.selected_host = tk.StringVar()
        
        # UI State for Pipeline Inspector
        self.pipeline_stages_ui = [] 
        
        self.setup_ui()
        self.load_config()

    def setup_ui(self):
        # Main Layout
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)

        # Tabs
        notebook = ttk.Notebook(main_frame)
        notebook.pack(fill=tk.BOTH, expand=True)

        # TAB 1: Auto Suite (Batch Test)
        self.tab_suite = ttk.Frame(notebook)
        notebook.add(self.tab_suite, text="Auto Test Suite")
        self.setup_suite_tab(self.tab_suite)

        # TAB 2: Manual Simulator (Granular Control)
        self.tab_sim = ttk.Frame(notebook)
        notebook.add(self.tab_sim, text="Manual Simulator & Inspector")
        self.setup_sim_tab(self.tab_sim)

        # Console Output (Shared)
        console_frame = ttk.LabelFrame(main_frame, text="Console Output", padding="5")
        console_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        
        self.console = scrolledtext.ScrolledText(console_frame, state='disabled', height=15, font=("Consolas", 9))
        self.console.pack(fill=tk.BOTH, expand=True)
        
        # Redirect logging
        handler = TextHandler(self.console)
        handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
        logging.getLogger().addHandler(handler)
        logging.getLogger().setLevel(logging.INFO)

    def setup_suite_tab(self, parent):
        # Layout: Left (Controls) - Right (Info)
        paned = ttk.PanedWindow(parent, orient=tk.HORIZONTAL)
        paned.pack(fill=tk.BOTH, expand=True, pady=5)

        left_frame = ttk.Frame(paned, padding=10)
        right_frame = ttk.Frame(paned, padding=10)
        paned.add(left_frame, weight=1)
        paned.add(right_frame, weight=2)

        # Host Selection
        ttk.Label(left_frame, text="Target Host(s) for Suite:").pack(anchor="w")
        self.suite_host_list = tk.Listbox(left_frame, height=15, exportselection=False, selectmode=tk.SINGLE)
        self.suite_host_list.pack(fill=tk.X, pady=5)
        
        # Options
        self.clean_env_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(left_frame, text="Clean Env (Del Reports/States)", variable=self.clean_env_var).pack(anchor="w", pady=5)

        # Buttons
        ttk.Button(left_frame, text="RUN SELECTED HOST (Full Pipeline)", command=lambda: self.run_suite(target="selected")).pack(fill=tk.X, pady=5)
        ttk.Button(left_frame, text="RUN ALL HOSTS (Batch)", command=lambda: self.run_suite(target="all")).pack(fill=tk.X, pady=5)
        
        # Info
        ttk.Label(right_frame, text="Logic tự động chạy (Suite Logic):", font=("Arial", 10, "bold")).pack(anchor="w")
        info_text = (
            "1. Init: Làm sạch folder reports & states (nếu tick chọn).\n"
            "2. Stage 0: Chạy log reader & analyzer.\n"
            "3. Mock Trigger: Tự động set buffer count > threshold để ép Stage sau chạy.\n"
            "4. Stage N: Chạy logic tổng hợp.\n"
            "5. Validation: Kiểm tra xem file report JSON có được sinh ra không.\n"
        )
        lbl = ttk.Label(right_frame, text=info_text, justify=tk.LEFT, wraplength=500)
        lbl.pack(anchor="w", pady=10)

    def setup_sim_tab(self, parent):

        
        paned = ttk.PanedWindow(parent, orient=tk.HORIZONTAL)
        paned.pack(fill=tk.BOTH, expand=True, pady=5)
        
        col1 = ttk.Frame(paned, padding=5); paned.add(col1, weight=1)
        col2 = ttk.Frame(paned, padding=5); paned.add(col2, weight=1)
        col3 = ttk.Frame(paned, padding=5); paned.add(col3, weight=2)

        # --- COL 1: Host Selection ---
        ttk.Label(col1, text="1. Select Host:").pack(anchor="w")
        self.host_listbox = tk.Listbox(col1, height=15, exportselection=False)
        self.host_listbox.pack(fill=tk.BOTH, expand=True, pady=5)
        self.host_listbox.bind('<<ListboxSelect>>', self.on_host_select)

        btn_frame = ttk.LabelFrame(col1, text="Global Actions", padding=5)
        btn_frame.pack(fill=tk.X, pady=10)
        ttk.Button(btn_frame, text="Reset All States", command=self.reset_states).pack(fill=tk.X, pady=2)
        ttk.Button(btn_frame, text="Reload Config File", command=self.load_config).pack(fill=tk.X, pady=2)

        # --- COL 2: Data Injection ---
        gen_frame = ttk.LabelFrame(col2, text="2. Log Injection", padding=5)
        gen_frame.pack(fill=tk.BOTH, expand=True)
        
        ttk.Label(gen_frame, text="Lines to Inject:").pack(anchor="w")
        self.log_count_var = tk.StringVar(value="1000")
        ttk.Entry(gen_frame, textvariable=self.log_count_var).pack(fill=tk.X, pady=5)
        
        ttk.Button(gen_frame, text="Inject Fake Logs", command=self.generate_fake_logs).pack(fill=tk.X, pady=10)
        
        ttk.Label(gen_frame, text="Note: Inject log xong thì mới chạy Stage 0 được.\nLog sẽ được ghi vào file cấu hình trong 'LogFile'.", 
                  font=("Arial", 8, "italic"), wraplength=150).pack(anchor="w", pady=10)

        # --- COL 3: Pipeline Inspector ---
        self.pipeline_frame = ttk.LabelFrame(col3, text="3. Pipeline Inspector & Manual Run", padding=5)
        self.pipeline_frame.pack(fill=tk.BOTH, expand=True)
        
        # Options Row
        opt_frame = ttk.Frame(self.pipeline_frame)
        opt_frame.pack(fill=tk.X, pady=5)
        self.force_trigger_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(opt_frame, text="Force Trigger (Hack Buffer)", variable=self.force_trigger_var).pack(side=tk.LEFT)
        
        # Scrollable container for dynamic buttons
        self.stage_canvas = tk.Canvas(self.pipeline_frame)
        self.scrollbar = ttk.Scrollbar(self.pipeline_frame, orient="vertical", command=self.stage_canvas.yview)
        self.stage_scroll_frame = ttk.Frame(self.stage_canvas)

        self.stage_scroll_frame.bind(
            "<Configure>",
            lambda e: self.stage_canvas.configure(scrollregion=self.stage_canvas.bbox("all"))
        )
        self.stage_canvas.create_window((0, 0), window=self.stage_scroll_frame, anchor="nw")
        self.stage_canvas.configure(yscrollcommand=self.scrollbar.set)

        self.stage_canvas.pack(side="left", fill="both", expand=True)
        self.scrollbar.pack(side="right", fill="y")


    # --- LOGIC ---

    def load_config(self):
        """Doc lai config va refresh UI."""
        self.host_listbox.delete(0, tk.END)
        self.suite_host_list.delete(0, tk.END)
        
        # Clean pipeline UI
        for widget in self.stage_scroll_frame.winfo_children():
            widget.destroy()
        
        if os.path.exists(TEST_CONFIG_FILE):
            self.config.read(TEST_CONFIG_FILE, encoding='utf-8')
            hosts = [s for s in self.config.sections() if s.startswith(('Host_', 'Firewall_'))]
            for h in hosts:
                self.host_listbox.insert(tk.END, h)
                self.suite_host_list.insert(tk.END, h)
            logging.info(f"Loaded {len(hosts)} hosts from config.")
        else:
            logging.error(f"Config file missing: {TEST_CONFIG_FILE}")

        # Setup Test Settings (System)
        if os.path.exists(TEST_SYS_SETTINGS):
            self.sys_config.read(TEST_SYS_SETTINGS, encoding='utf-8')
            if 'System' not in self.sys_config: self.sys_config.add_section('System')
            self.sys_config['System']['report_directory'] = TEST_REPORTS_DIR
            # Ensure dirs exist
            os.makedirs(TEST_REPORTS_DIR, exist_ok=True)
            os.makedirs(TEST_STATE_DIR, exist_ok=True)

    def on_host_select(self, event):
        """Khi chon host, parse pipeline config va render nut bam."""
        selection = event.widget.curselection()
        if not selection: return
        
        host = event.widget.get(selection[0])
        self.selected_host.set(host)
        
        # Clear old UI
        for widget in self.stage_scroll_frame.winfo_children():
            widget.destroy()
            
        # Parse Pipeline
        pipeline_json = self.config.get(host, 'pipeline_config', fallback='[]')
        try:
            pipeline = json.loads(pipeline_json)
        except Exception as e:
            logging.error(f"Error parsing pipeline for {host}: {e}")
            return
            
        if not pipeline:
            ttk.Label(self.stage_scroll_frame, text="No pipeline configured.").pack(pady=10)
            return
            
        # Render Stage Controls
        for idx, stage in enumerate(pipeline):
            frame = ttk.Frame(self.stage_scroll_frame, borderwidth=1, relief="solid", padding=5)
            frame.pack(fill=tk.X, pady=5, padx=5)
            
            # Header line
            header_frame = ttk.Frame(frame)
            header_frame.pack(fill=tk.X)
            
            stage_name = stage.get('name', f'Stage {idx}')
            lbl = ttk.Label(header_frame, text=f"Stage {idx}: {stage_name}", font=("Arial", 10, "bold"))
            lbl.pack(side=tk.LEFT)
            
            # Detail line
            details = f"Model: {stage.get('model', 'N/A')}"
            if idx > 0:
                details += f" | Trigger: {stage.get('trigger_threshold', 1)}"
            ttk.Label(frame, text=details, font=("Arial", 8)).pack(anchor="w")
            
            # Action Button
            btn_text = "RUN LOG SCAN" if idx == 0 else "RUN AGGREGATION"
            # // Quan trong: dung lambda x=idx de capture gia tri idx tai thoi diem loop
            btn = ttk.Button(frame, text=btn_text, command=lambda i=idx: self.run_specific_stage_thread(host, i))
            btn.pack(fill=tk.X, pady=5)

    # --- ACTION HANDLERS ---

    def run_specific_stage_thread(self, host, stage_idx):
        """Wrapper de chay thread, khong treo UI."""
        threading.Thread(target=lambda: self._run_specific_stage_logic(host, stage_idx)).start()

    def _run_specific_stage_logic(self, host, stage_idx):
        logging.info(f"--- MANUAL RUN: {host} | STAGE {stage_idx} ---")
        
        # Reload config de dam bao moi nhat
        self.config.read(TEST_CONFIG_FILE, encoding='utf-8')
        pipeline = json.loads(self.config.get(host, 'pipeline_config', fallback='[]'))
        
        stage_conf = pipeline[stage_idx]
        
        # Resolve API Key
        raw_api_key = self.config.get(host, 'GeminiAPIKey', fallback='')
        api_key = resolve_api_key(raw_api_key, self.sys_config)
        
        try:
            if stage_idx == 0:
                success = run_pipeline_stage_0(
                    self.config, host, stage_conf, api_key, self.sys_config, test_mode=True
                )
                if success:
                    logging.info(">>> Stage 0 SUCCESS.")
                else:
                    logging.error(">>> Stage 0 FAILED.")
            else:
                prev_stage = pipeline[stage_idx - 1]
                
                if self.force_trigger_var.get():
                    threshold = int(stage_conf.get('trigger_threshold', 1))
                    logging.info(f"Force Trigger: Hacking buffer count to {threshold + 1}")
                    state_manager.save_stage_buffer_count(host, stage_idx, threshold + 1, test_mode=True)
                
                success = run_pipeline_stage_n(
                    self.config, host, stage_idx, stage_conf, prev_stage, 
                    api_key, self.sys_config, test_mode=True
                )
                
                if success:
                    logging.info(f">>> Stage {stage_idx} SUCCESS.")
                    state_manager.save_stage_buffer_count(host, stage_idx, 0, test_mode=True)
                else:
                    logging.error(f">>> Stage {stage_idx} FAILED (Check logs/buffer).")
                    
        except Exception as e:
            logging.error(f"EXCEPTION during manual run: {e}", exc_info=True)

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
                        f.write(f"{now} pfsense filterlog: [TEST-GEN] Log line {i+1} src=192.168.1.{i%255} dst=8.8.8.8\n")
                logging.info("Injection Done.")
            except Exception as e: logging.error(f"Gen failed: {e}")
        threading.Thread(target=_gen).start()

    def reset_states(self):
        host = self.selected_host.get()
        if host: 
            state_manager.reset_all_states(host, test_mode=True)
            logging.info(f"Reset states for {host}")
        else:
            if os.path.exists(TEST_STATE_DIR):
                shutil.rmtree(TEST_STATE_DIR)
                os.makedirs(TEST_STATE_DIR)
                logging.info("Cleared ALL test states.")

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

        if not hosts_to_run: return messagebox.showerror("Error", "No hosts found.")

        threading.Thread(target=self._suite_worker, args=(hosts_to_run,)).start()

    def _suite_worker(self, hosts):
        if self.clean_env_var.get():
            self.clean_environment()
            
        self.config.read(TEST_CONFIG_FILE, encoding='utf-8')
        total = len(hosts)
        passed = 0
        failed = 0

        logging.info(f"=== STARTING SUITE: {total} HOSTS ===")

        for host in hosts:
            logging.info(f"--- TESTING HOST: {host} ---")
            
            if not self.config.getboolean(host, 'enabled', fallback=True):
                logging.info(f"Skipping disabled host: {host}")
                continue

            pipeline_json = self.config.get(host, 'pipeline_config', fallback='[]')
            try: pipeline = json.loads(pipeline_json)
            except: 
                logging.error(f"Invalid pipeline config for {host}")
                failed += 1; continue

            raw_api_key = self.config.get(host, 'GeminiAPIKey', fallback='')
            api_key = resolve_api_key(raw_api_key, self.sys_config)

            host_failed = False

            if not pipeline: continue
            
            try:
                logging.info(f"Running Stage 0...")
                s0_success = run_pipeline_stage_0(
                    self.config, host, pipeline[0], api_key, self.sys_config, test_mode=True
                )
                if not s0_success:
                    logging.error("Stage 0 FAILED. Aborting host.")
                    host_failed = True
            except Exception as e:
                logging.error(f"Exception Stage 0: {e}")
                host_failed = True


            if not host_failed:
                for i in range(1, len(pipeline)):
                    current = pipeline[i]
                    prev = pipeline[i-1]
                    threshold = int(current.get('trigger_threshold', 1))

                    logging.info(f"Mocking Buffer for Stage {i}...")
                    state_manager.save_stage_buffer_count(host, i, threshold + 1, test_mode=True)
                    
                    try:
                        sn_success = run_pipeline_stage_n(
                            self.config, host, i, current, prev, api_key, self.sys_config, test_mode=True
                        )
                        if not sn_success:
                            logging.error(f"Stage {i} FAILED.")
                            host_failed = True; break
                    except Exception as e:
                        logging.error(f"Exception Stage {i}: {e}")
                        host_failed = True; break
            
            if host_failed: failed += 1
            else: passed += 1
            logging.info("-" * 30)

        logging.info(f"=== SUITE FINISHED: PASSED {passed} | FAILED {failed} ===")
        messagebox.showinfo("Suite Finished", f"Passed: {passed}\nFailed: {failed}")

if __name__ == "__main__":
    root = tk.Tk()
    app = LogAnalyzerTesterApp(root)
    root.mainloop()