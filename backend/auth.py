import hmac
import os
from datetime import timedelta

import jwt
from fastapi import Header, HTTPException
from sqlalchemy.orm import Session

from .db import LoginFailure, as_utc, utcnow

MAX_FAILURES = 5
LOCK_DURATION = timedelta(minutes=5)
TOKEN_TTL = timedelta(hours=12)


def _secret() -> str:
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        raise HTTPException(500, "서버 설정 오류: JWT_SECRET이 없습니다")
    return secret


def login(db: Session, ip: str, password: str) -> str:
    admin_password = os.environ.get("ADMIN_PASSWORD")
    if not admin_password:
        raise HTTPException(500, "서버 설정 오류: ADMIN_PASSWORD가 없습니다")

    now = utcnow()
    rec = db.get(LoginFailure, ip)
    if rec and rec.locked_until:
        locked_until = as_utc(rec.locked_until)
        if locked_until > now:
            minutes = int((locked_until - now).total_seconds() // 60) + 1
            raise HTTPException(429, f"로그인 시도가 너무 많아요. {minutes}분 뒤에 다시 시도하세요")
        rec.count, rec.locked_until = 0, None

    if hmac.compare_digest(password.encode(), admin_password.encode()):
        if rec:
            db.delete(rec)
            db.commit()
        return jwt.encode({"sub": "admin", "exp": now + TOKEN_TTL}, _secret(), algorithm="HS256")

    if rec is None:
        rec = LoginFailure(ip=ip, count=0)
        db.add(rec)
    rec.count += 1
    if rec.count >= MAX_FAILURES:
        rec.locked_until = now + LOCK_DURATION
        db.commit()
        raise HTTPException(429, "비밀번호를 5번 틀렸어요. 5분 뒤에 다시 시도하세요")
    db.commit()
    raise HTTPException(401, f"비밀번호가 틀렸어요 ({rec.count}/{MAX_FAILURES})")


def require_admin(authorization: str | None = Header(default=None)) -> None:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "로그인이 필요합니다")
    try:
        jwt.decode(authorization[7:], _secret(), algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "로그인이 만료되었습니다")
