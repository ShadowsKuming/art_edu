import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Header, HTTPException
from jose import JWTError, jwt

_SECRET = os.getenv("JWT_SECRET", "artbloom-dev-secret-change-in-prod")
_ALGO = "HS256"
_EXPIRE_DAYS = 90


def create_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=_EXPIRE_DAYS)
    return jwt.encode({"sub": user_id, "exp": expire}, _SECRET, algorithm=_ALGO)


def _decode(token: str) -> str:
    try:
        payload = jwt.decode(token, _SECRET, algorithms=[_ALGO])
        uid: Optional[str] = payload.get("sub")
        if not uid:
            raise HTTPException(401, "Invalid token payload")
        return uid
    except JWTError:
        raise HTTPException(401, "Invalid or expired token")


def get_current_user_id(authorization: Optional[str] = Header(None)) -> str:
    """FastAPI dependency — extracts and verifies Bearer token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing or invalid Authorization header")
    return _decode(authorization[7:])
