import pytest
import sys
import os
import shutil
from fastapi.testclient import TestClient

# Hack sys.path để import được modules từ backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api import app
from modules import utils

@pytest.fixture
def client():
    """Fixture tạo client giả lập để gọi API mà không cần run server thật."""
    return TestClient(app)

@pytest.fixture
def temp_test_env(tmp_path):
    """
    Tạo môi trường file tạm thời.
    Mọi file tạo ra trong test sẽ nằm trong RAM/Temp folder và tự xóa sau khi test xong.
    """
    # Override các path trong code bằng path ảo
    config_path = tmp_path / "config.ini"
    report_dir = tmp_path / "reports"
    os.makedirs(report_dir, exist_ok=True)
    
    return {
        "config_file": str(config_path),
        "report_dir": str(report_dir),
        "root": tmp_path
    }