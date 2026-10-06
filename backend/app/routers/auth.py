from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import create_session, current_user, get_session, verify_password
from ..database import get_db
from ..models import SessionToken, User
from ..schemas import LoginRequest, LoginResponse, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == body.username.strip().lower()))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail={"code": "AuthFailure", "message": "Your authentication information is incorrect. Please try again."},
        )
    if body.account_id and body.account_id.strip() not in (user.account_id, user.account_id.replace("-", "")):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail={"code": "AuthFailure", "message": "Your authentication information is incorrect. Please try again."},
        )
    sess = create_session(db, user)
    return LoginResponse(token=sess.token, expires_at=sess.expires_at, user=UserOut.model_validate(user))


@router.post("/logout", status_code=204)
def logout(sess: SessionToken = Depends(get_session), db: Session = Depends(get_db)):
    db.delete(db.merge(sess))
    db.commit()


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user
