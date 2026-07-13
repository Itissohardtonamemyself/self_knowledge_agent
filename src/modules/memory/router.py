from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_db_session
from ...schemas.common import ApiResponse
from ...schemas.memory import (
    UserProfileOut, UserProfileUpdate,
    LongTermMemoryCreate, LongTermMemoryOut,
)
from ...core.logging import log
from ...core.exceptions import AppBaseException, to_http_exception
from .service import MemoryService

router = APIRouter(prefix="/memory", tags=["记忆与个性化 Memory"])
_service = MemoryService()


@router.get("/profile", response_model=ApiResponse[UserProfileOut])
async def get_profile(db: AsyncSession = Depends(get_db_session)):
    try:
        return ApiResponse.success(await _service.get_profile(db))
    except AppBaseException as e:
        raise to_http_exception(e)
    except Exception as e:
        log.exception("get_profile error")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/profile", response_model=ApiResponse[UserProfileOut])
async def update_profile(update: UserProfileUpdate, db: AsyncSession = Depends(get_db_session)):
    try:
        return ApiResponse.success(await _service.update_profile(db, update))
    except AppBaseException as e:
        raise to_http_exception(e)
    except Exception as e:
        log.exception("update_profile error")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/long-term", response_model=ApiResponse[LongTermMemoryOut])
async def create_memory(data: LongTermMemoryCreate, db: AsyncSession = Depends(get_db_session)):
    try:
        return ApiResponse.success(await _service.create_long_term_memory(db, data))
    except AppBaseException as e:
        raise to_http_exception(e)
    except Exception as e:
        log.exception("create_memory error")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/long-term", response_model=ApiResponse[dict])
async def list_memories(
    keyword: str = "", status: str = "active",
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=200),
    db: AsyncSession = Depends(get_db_session),
):
    try:
        return ApiResponse.success(await _service.list_long_term_memories(
            db, keyword=keyword, status=status, page=page, page_size=page_size,
        ))
    except Exception as e:
        log.exception("list_memories error")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/long-term/{memory_id}", response_model=ApiResponse[dict])
async def delete_memory(memory_id: int, db: AsyncSession = Depends(get_db_session)):
    try:
        return ApiResponse.success(await _service.delete_long_term_memory(db, memory_id))
    except AppBaseException as e:
        raise to_http_exception(e)
    except Exception as e:
        log.exception("delete_memory error")
        raise HTTPException(status_code=500, detail=str(e))
