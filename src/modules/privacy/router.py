from __future__ import annotations

import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_db_session
from ...schemas.common import ApiResponse
from ...core.logging import log
from ...core.security import mask_sensitive
from .service import PrivacyService

router = APIRouter(prefix="/privacy", tags=["隐私与安全 Privacy"])
_service = PrivacyService()


@router.post("/export", response_model=ApiResponse[dict])
async def export_all(db: AsyncSession = Depends(get_db_session),
                     export_dir: Optional[str] = None):
    try:
        return ApiResponse.success(await _service.export_all(db, export_dir=export_dir))
    except Exception as e:
        log.exception("export")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/download-export")
async def download_export(file_path: str):
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="导出文件不存在")
    return FileResponse(file_path, media_type="application/zip",
                        filename=os.path.basename(file_path))


@router.post("/wipe", response_model=ApiResponse[dict])
async def wipe_all(confirm: bool = Query(..., description="必须传 True 确认擦除"),
                   db: AsyncSession = Depends(get_db_session)):
    try:
        return ApiResponse.success(await _service.wipe_all(db, confirm=confirm))
    except Exception as e:
        log.exception("wipe_all")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mask", response_model=ApiResponse[str])
def mask_text(text: str):
    try:
        return ApiResponse.success(mask_sensitive(text))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
