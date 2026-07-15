from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_db_session
from ...schemas.common import ApiResponse
from ...schemas.auth import LoginRequest, RegisterRequest, LoginResponse
from .service import AuthService

router = APIRouter(tags=["认证 Auth"])
_service = AuthService()


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