import os
import time
import contextlib
import logging
import json
import re
import errno
import random

# // thoi gian cho toi da truoc khi timeout lock
LOCK_TIMEOUT = 10  

@contextlib.contextmanager
def file_lock(file_path):
    """
    Co che khoa file ATOMIC ho tro cross-platform (Windows/Linux).
    """
    lock_file = f"{file_path}.lock"
    start_time = time.time()
    
    lock_fd = None
    
    while True:
        try:
            # os.O_EXCL dam bao atomic creation
            lock_fd = os.open(lock_file, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.write(lock_fd, str(os.getpid()).encode())
            break
            
        except OSError as e:
            # Fix cho Windows: Errno 13 (PermissionError) xay ra khi file dang bi khoa hoac pending delete
            if e.errno == errno.EEXIST or (os.name == 'nt' and e.errno == 13):
                
                # Check timeout deadlock
                try:
                    if os.path.exists(lock_file) and time.time() - os.path.getmtime(lock_file) > LOCK_TIMEOUT:
                        logging.warning(f"Removing stale lock file: {lock_file}")
                        try:
                            os.remove(lock_file)
                        except OSError:
                            pass # Co the thread khac da xoa roi
                        continue
                except OSError:
                    pass 

                if time.time() - start_time > LOCK_TIMEOUT:
                    raise TimeoutError(f"Could not acquire lock for {file_path} after {LOCK_TIMEOUT}s")
                
                # Backoff random de tranh thundering herd (cac thread cung thuc day 1 luc)
                time.sleep(random.uniform(0.05, 0.15))
            else:
                raise

    try:
        yield
    finally:
        if lock_fd is not None:
            try:
                os.close(lock_fd)
            except OSError:
                pass
        
        # Co gang xoa file lock
        if os.path.exists(lock_file):
            try:
                os.remove(lock_file)
            except OSError:
                # Tren Windows, doi khi xoa file vua dong se bi loi neu AV dang scan hoac I/O cham
                pass

def verify_safe_path(base_dir, requested_path):
    """
    Security: Chan Path Traversal.
    Dam bao path duoc yeu cau nam ben trong base_dir.
    """
    if not base_dir:
        raise ValueError("Base directory not configured.")

    # // resolve absolute paths
    abs_base = os.path.abspath(base_dir)
    abs_requested = os.path.abspath(requested_path)
    
    # // kiem tra xem path yeu cau co bat dau bang base path khong
    if not abs_requested.startswith(abs_base):
        logging.warning(f"Path traversal attempt detected: {requested_path}")
        raise PermissionError("Access denied: Invalid path.")
    
    return abs_requested

def extract_json_from_text(text):
    """
    Helper thong minh de lay JSON tu text cua AI.
    Xu ly duoc cac truong hop: Markdown block, Raw JSON, hoac lan lon text.
    """
    if not text: return {}
    
    try:
        match = re.search(r'```json\s*(.*?)\s*```', text, re.DOTALL | re.IGNORECASE)
        if match:
            return json.loads(match.group(1))
            
        match = re.search(r'```\s*(.*?)\s*```', text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except: pass

        start = text.find('{')
        end = text.rfind('}')
        if start != -1 and end != -1:
            json_str = text[start:end+1]
            return json.loads(json_str)
            
    except json.JSONDecodeError:
        logging.warning("Failed to parse JSON from AI response.")
        return {}
    
    return {}