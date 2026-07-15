from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_db_session
from ...schemas.common import ApiResponse
from ...schemas.auth import LoginRequest, RegisterRequest, UpdateUserRequest, LoginResponse, UserOut
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


@router.get("/user/me", response_model=ApiResponse[UserOut])
async def get_current_user(user_id: int = 1):
    from ...db.session import get_session_factory
    async with get_session_factory()() as db:
        user = await _service.get_user_by_id(db, user_id)
        return ApiResponse.success(UserOut.from_orm(user))


@router.put("/user/me", response_model=ApiResponse[UserOut])
async def update_current_user(req: UpdateUserRequest, user_id: int = 1):
    from ...db.session import get_session_factory
    async with get_session_factory()() as db:
        user = await _service.update_user(db, user_id, req)
        return ApiResponse.success(UserOut.from_orm(user), message="用户信息更新成功")