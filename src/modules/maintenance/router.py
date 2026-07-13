from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_db_session
from ...schemas.common import ApiResponse
from ...core.logging import log
from .service import MaintenanceService

router = APIRouter(prefix="/maintenance", tags=["维护与扩展 Maintenance"])
_service = MaintenanceService()


@router.post("/health-check", response_model=ApiResponse[dict])
async def health_check(db: AsyncSession = Depends(get_db_session)):
    try:
        return ApiResponse.success(await _service.health_check(db))
    except Exception as e:
        log.exception("health_check")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/backup", response_model=ApiResponse[dict])
async def create_backup(backup_dir: Optional[str] = None):
    try:
        return ApiResponse.success(await _service.create_backup(backup_dir))
    except Exception as e:
        log.exception("backup")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/restore", response_model=ApiResponse[dict])
async def restore_backup(backup_path: str, overwrite: bool = True):
    try:
        return ApiResponse.success(await _service.restore_backup(backup_path, overwrite=overwrite))
    except Exception as e:
        log.exception("restore")
        raise HTTPException(status_code=500, detail=str(e))
