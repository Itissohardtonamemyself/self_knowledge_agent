from __future__ import annotations

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class UserProfileOut(BaseModel):
    occupation: str = ""
    domains: list[str] = Field(default_factory=list)
    preferences: dict = Field(default_factory=dict)
    auto_update: bool = True
    custom_prompt: str = ""
    updated_at: datetime

    class Config:
        from_attributes = True


class UserProfileUpdate(BaseModel):
    occupation: Optional[str] = None
    domains: Optional[list[str]] = None
    preferences: Optional[dict] = None
    auto_update: Optional[bool] = None
    custom_prompt: Optional[str] = None


class LongTermMemoryBase(BaseModel):
    content: str
    source_type: str = "user_explicit"
    importance_score: float = 0.5
    tags: list[str] = Field(default_factory=list)


class LongTermMemoryCreate(LongTermMemoryBase):
    pass


class LongTermMemoryOut(LongTermMemoryBase):
    id: int
    access_count: int = 0
    last_accessed_at: Optional[datetime] = None
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
