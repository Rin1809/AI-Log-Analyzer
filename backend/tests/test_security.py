import pytest
import os
from modules.utils import verify_safe_path

class TestDeepSecurity:
    
    def test_path_traversal_attack(self, temp_test_env):
        """
        Kiểm tra hacker cố tình dùng ../.. để đọc file hệ thống.
        """
        base_dir = str(temp_test_env['report_dir'])
        
        # Các payloads tấn công phổ biến
        attack_vectors = [
            "../../config.ini",
            "../../../etc/passwd",
            f"{base_dir}/../../secret.txt",
            "Host1/../..//Windows/System32/drivers/etc/hosts"
        ]

        for vector in attack_vectors:
            with pytest.raises(PermissionError) as excinfo:
                verify_safe_path(base_dir, vector)
            assert "Access denied" in str(excinfo.value)

    def test_ini_injection_via_api(self, client):
            """
            Kiểm tra INI Injection: Cố tình đặt tên Host chứa ký tự xuống dòng.
            """
            # Payload độc hại
            malicious_hostname = "HackerHost]\n[System]\nadmin_password=hacked"
            
            payload = {
                "syshostname": malicious_hostname,
                "logfile": "/var/log/test.log",
                "run_interval_seconds": 3600,
                "hourstoanalyze": 24,
                "timezone": "UTC",
                "geminiapikey": "dummy",
                "networkdiagram": ""
            }

            response = client.post("/api/hosts", json=payload)
            
            # FIX: Kiểm tra HTTP Code thay vì kiểm tra chuỗi input
            # 422 Unprocessable Entity là mã lỗi Pydantic trả về khi validation fail
            assert response.status_code == 422, f"API should reject newline in hostname. Got: {response.status_code}"