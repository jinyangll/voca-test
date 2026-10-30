# Vercel Python 서버리스 함수 진입점. /api/* 요청은 vercel.json에서 여기로 보낸다.
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.main import app  # noqa: E402,F401
