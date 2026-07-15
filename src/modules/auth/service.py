from __future__ import annotations

import hashlib
import os
import uuid
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.models.user import User
from ...schemas.auth import LoginRequest, RegisterRequest, UserOut, UserUpdate
from ...core.exceptions import AppBaseException


class AuthService:
    @staticmethod
    def _hash_password(password: str, salt: Optional[str] = None) -> str:
        if salt is None:
            salt = os.urandom(16).hex()
        combined = f"{salt}{password}".encode("utf-8")
        return f"{salt}${hashlib.sha256(combined).hexdigest()}"

    @staticmethod
    def _verify_password(password: str, password_hash: str) -> bool:
        try:
            salt, hash_part = password_hash.split("$", 1)
            combined = f"{salt}{password}".encode("utf-8")
            return hashlib.sha256(combined).hexdigest() == hash_part
        except Exception:
            return False

    @staticmethod
    def _generate_token() -> str:
        return str(uuid.uuid4())

    async def login(self, db: AsyncSession, req: LoginRequest) -> dict:
        identifier = req.username_or_email_or_phone
        user = await self._get_user_by_identifier(db, identifier)
        
        if not user:
            exc = AppBaseException(code="USER_NOT_FOUND", message="用户不存在，请先注册")
            exc.status_code = 404
            raise exc

        if not user.is_active:
            exc = AppBaseException(code="USER_INACTIVE", message="用户已被禁用，请联系管理员")
            exc.status_code = 403
            raise exc

        if not self._verify_password(req.password, user.password_hash):
            exc = AppBaseException(code="INVALID_PASSWORD", message="密码错误，请重新输入")
            exc.status_code = 401
            raise exc

        token = self._generate_token()
        return {
            "user": UserOut.from_orm(user),
            "token": token,
            "token_expires_at": (datetime.utcnow() + timedelta(days=7)).isoformat(),
        }

    async def register(self, db: AsyncSession, req: RegisterRequest) -> dict:
        existing = await self._get_user_by_identifier(db, req.username)
        if existing:
            exc = AppBaseException(code="USER_EXISTS", message="用户名已被注册，请选择其他用户名")
            exc.status_code = 409
            raise exc

        if req.phone:
            phone_exists = (await db.execute(select(User).where(User.phone == req.phone))).scalar_one_or_none()
            if phone_exists:
                exc = AppBaseException(code="PHONE_EXISTS", message="该手机号已被注册，请使用其他手机号")
                exc.status_code = 409
                raise exc

        if req.email:
            email_exists = (await db.execute(select(User).where(User.email == req.email))).scalar_one_or_none()
            if email_exists:
                exc = AppBaseException(code="EMAIL_EXISTS", message="该邮箱已被注册，请使用其他邮箱")
                exc.status_code = 409
                raise exc

        user = User(
            username=req.username,
            password_hash=self._hash_password(req.password),
            phone=req.phone,
            email=req.email,
            name=req.name or req.username,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        token = self._generate_token()
        return {
            "user": UserOut.from_orm(user),
            "token": token,
            "token_expires_at": (datetime.utcnow() + timedelta(days=7)).isoformat(),
        }

    async def _get_user_by_identifier(self, db: AsyncSession, identifier: str) -> Optional[User]:
        result = await db.execute(select(User).where(User.username == identifier))
        user = result.scalar_one_or_none()
        if user:
            return user

        if "@" in identifier:
            result = await db.execute(select(User).where(User.email == identifier))
            user = result.scalar_one_or_none()
            if user:
                return user

        if identifier.isdigit() and len(identifier) in (11,):
            result = await db.execute(select(User).where(User.phone == identifier))
            user = result.scalar_one_or_none()
            if user:
                return user

        return None

    async def get_user_by_id(self, db: AsyncSession, user_id: int) -> Optional[User]:
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def update_user(self, db: AsyncSession, user_id: int, update: UserUpdate) -> User:
        user = await self.get_user_by_id(db, user_id)
        if not user:
            exc = AppBaseException(code="USER_NOT_FOUND", message="用户不存在")
            exc.status_code = 404
            raise exc

        if update.username and update.username != user.username:
            existing = await self._get_user_by_identifier(db, update.username)
            if existing and existing.id != user_id:
                exc = AppBaseException(code="USER_EXISTS", message="用户名已被占用，请选择其他用户名")
                exc.status_code = 409
                raise exc
            user.username = update.username

        if update.phone and update.phone != user.phone:
            phone_exists = (await db.execute(select(User).where(User.phone == update.phone))).scalar_one_or_none()
            if phone_exists and phone_exists.id != user_id:
                exc = AppBaseException(code="PHONE_EXISTS", message="该手机号已被注册，请使用其他手机号")
                exc.status_code = 409
                raise exc
            user.phone = update.phone

        if update.email and update.email != user.email:
            email_exists = (await db.execute(select(User).where(User.email == update.email))).scalar_one_or_none()
            if email_exists and email_exists.id != user_id:
                exc = AppBaseException(code="EMAIL_EXISTS", message="该邮箱已被注册，请使用其他邮箱")
                exc.status_code = 409
                raise exc
            user.email = update.email

        if update.name is not None:
            user.name = update.name

        await db.commit()
        await db.refresh(user)
        return user