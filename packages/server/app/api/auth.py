import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from datetime import timedelta

from ..db.session import get_db
from ..db.models import User
from ..core.security import verify_password, get_password_hash, create_access_token, get_current_user, _decode_token
from ..core.config import settings
from ..core.rate_limit import auth_rate_limit

logger = logging.getLogger(__name__)

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")


class UserCreate(BaseModel):
    username: str
    email: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class RegisterResponse(BaseModel):
    access_token: str
    token_type: str
    id: int
    username: str
    email: str


@router.post("/register", response_model=RegisterResponse, dependencies=[Depends(auth_rate_limit)])
def register(user: UserCreate, db: Session = Depends(get_db)):
    try:
        db_user = db.query(User).filter(
            (User.username == user.username) | (User.email == user.email)
        ).first()
        if db_user:
            raise HTTPException(status_code=400, detail="Username or email already registered")

        hashed_password = get_password_hash(user.password)
        db_user = User(username=user.username, email=user.email, hashed_password=hashed_password)
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.error("Database error during registration: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database error during registration. Please try again later.",
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": db_user.username}, expires_delta=access_token_expires
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "id": db_user.id,
        "username": db_user.username,
        "email": db_user.email,
    }


@router.post("/login", response_model=Token, dependencies=[Depends(auth_rate_limit)])
def login(user: UserLogin, db: Session = Depends(get_db)):
    try:
        db_user = db.query(User).filter(User.username == user.username).first()
    except SQLAlchemyError as exc:
        logger.error("Database error during login: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database error during login. Please try again later.",
        )

    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": db_user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/refresh", response_model=Token)
def refresh_token(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    """Issue a new token with refreshed expiration using the current Bearer token."""
    username = _decode_token(token)  # raises 401 if invalid

    try:
        user = db.query(User).filter(User.username == username).first()
    except SQLAlchemyError as exc:
        logger.error("Database error during token refresh: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database error during token refresh. Please try again later.",
        )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    new_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": new_token, "token_type": "bearer"}


@router.get("/me")
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user
