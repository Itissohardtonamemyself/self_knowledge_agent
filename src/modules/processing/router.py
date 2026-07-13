from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_db_session
from ...schemas.common import ApiResponse
from ...core.logging import log
from ...core.exceptions import AppBaseException, to_http_exception
from .service import ProcessingService

router = APIRouter(prefix="/processing", tags=["知识处理层 Processing"])

_service = ProcessingService()


@router.post("/reindex/{doc_id}", response_model=ApiResponse[dict])
async def reindex_document(doc_id: str, db: AsyncSession = Depends(get_db_session)):
    try:
        return ApiResponse.success(await _service.reindex_document(db, doc_id))
    except AppBaseException as e:
        raise to_http_exception(e)
    except Exception as e:
        log.exception(f"reindex {doc_id} error")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reindex-all", response_model=ApiResponse[dict])
async def reindex_all(
    incremental: bool = True,
    db: AsyncSession = Depends(get_db_session),
):
    try:
        return ApiResponse.success(await _service.reindex_all(db, incremental=incremental))
    except AppBaseException as e:
        raise to_http_exception(e)
    except Exception as e:
        log.exception("reindex all error")
        raise HTTPException(status_code=500, detail=str(e))
