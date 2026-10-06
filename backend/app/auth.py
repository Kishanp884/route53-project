"""Mocked authentication.

Users sign in with a username/password stored (hashed) in SQLite. A random
opaque token is issued and stored in the `sessions` table; the frontend sends
it as `Authorization: Bearer <token>`. Sessions expire after SESSION_TTL_HOURS.
"""
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from .models import SessionToken, User

SESSION_TTL_HOURS = int(os.getenv("SESSION_TTL_HOURS", "12"))
_SALT = os.getenv("PASSWORD_SALT", "route53-clone")


def hash_password(password: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), _SALT.encode(), 100_000).hex()


def verify_password(password: str, password_hash: str) -> bool:
    return hmac.compare_digest(hash_password(password), password_hash)


def create_session(db: Session, user: User) -> SessionToken:
    tok = SessionToken(
        token=secrets.token_urlsafe(32),
        user_id=user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=SESSION_TTL_HOURS),
    )
    db.add(tok)
    db.commit()
    return tok


def _as_aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def get_session(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> SessionToken:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing authentication token.")
    token = authorization.split(" ", 1)[1].strip()
    sess = db.get(SessionToken, token)
    if not sess:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "The security token included in the request is invalid.")
    if _as_aware(sess.expires_at) < datetime.now(timezone.utc):
        db.delete(sess)
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "The security token included in the request is expired.")
    return sess


def current_user(sess: SessionToken = Depends(get_session)) -> User:
    return sess.user
