from __future__ import annotations

from datetime import datetime
from typing import Any, Optional, Generic, TypeVar
from pydantic import BaseModel, Field

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    code: int = 0
    message: str = "ok"
    data: Optional[T] = None
    trace_id: Optional[str] = None

    @classmethod
    def success(cls, data: T = None, message: str = "ok") -> "ApiResponse[T]":
        return cls(code=0, message=message, data=data)

    @classmethod
    def error(cls, code: int = -1, message: str = "error", data: Any = None) -> "ApiResponse[T]":
        return cls(code=code, message=message, data=data)


class Pagination(BaseModel):
    total: int = 0
    page: int = 1
    page_size: int = 20
    total_pages: int = 0


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    pagination: Pagination


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "0.1.0"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    stats: dict[str, Any] = Field(default_factory=dict)
