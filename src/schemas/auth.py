from __future__ import annotations

import re
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator


class UserOut(BaseModel):
    id: int
    username: str
    phone: Optional[str]
    email: Optional[str]
    name: Optional[str]
    is_active: bool
    is_admin: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    username_or_email_or_phone: str = Field(..., description="用户名、邮箱或手机号")
    password: str = Field(..., min_length=6, description="密码，至少6位")


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=64, description="用户名")
    password: str = Field(..., min_length=6, description="密码，至少6位")
    phone: Optional[str] = Field(None, description="手机号")
    email: Optional[str] = Field(None, description="邮箱")
    name: Optional[str] = Field(None, description="用户姓名")

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        if v:
            if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', v):
                raise ValueError('邮箱格式不正确')
        return v

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v:
            if not re.match(r'^1[3-9]\d{9}$', v):
                raise ValueError('手机号格式不正确')
        return v


class LoginResponse(BaseModel):
    user: UserOut
    token: str
    token_expires_at: str


class UpdateUserRequest(BaseModel):
    phone: Optional[str] = Field(None, description="手机号")
    email: Optional[str] = Field(None, description="邮箱")
    name: Optional[str] = Field(None, description="用户姓名")

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        if v:
            if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', v):
                raise ValueError('邮箱格式不正确')
        return v

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v:
            if not re.match(r'^1[3-9]\d{9}$', v):
                raise ValueError('手机号格式不正确')
        return v