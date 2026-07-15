from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_db_session
from ...db.models.user import User
from ...schemas.common import ApiResponse
from ...schemas.auth import LoginRequest, RegisterRequest, LoginResponse, UserOut, UserUpdate
from ...core.logging import log
from ...core.exceptions import AppBaseException, to_http_exception
from .service import AuthService

router = APIRouter(tags=["认证 Auth"])
_service = AuthService()


async def get_current_user(authorization: Optional[str] = Header(None), db: AsyncSession = Depends(get_db_session)) -> User:
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
        users = (await db.execute(select(User))).scalars().all()
        if users:
            return users[0]
    raise HTTPException(status_code=401, detail="认证失败")


@router.post("/login", response_model=ApiResponse[LoginResponse])
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db_session)):
    result = await _service.login(db, req)
    return ApiResponse.success(result)


@router.post("/register", response_model=ApiResponse[LoginResponse])
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db_session)):
    result = await _service.register(db, req)
    return ApiResponse.success(result, message="注册成功")


@router.post("/logout")
async def logout():
    return ApiResponse.success(message="登出成功")


@router.get("/me", response_model=ApiResponse[UserOut])
async def get_current_user_info(user: User = Depends(get_current_user)):
    return ApiResponse.success(UserOut.from_orm(user))


@router.put("/user", response_model=ApiResponse[UserOut])
async def update_user_info(update: UserUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db_session)):
    try:
        updated = await _service.update_user(db, user.id, update)
        return ApiResponse.success(UserOut.from_orm(updated), message="更新成功")
    except AppBaseException as e:
        raise to_http_exception(e)
    except Exception as e:
        log.exception("update_user_info error")
        raise HTTPException(status_code=500, detail=str(e))