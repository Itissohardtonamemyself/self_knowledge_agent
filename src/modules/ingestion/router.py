from __future__ import annotations

import os
import tempfile
from typing import Optional

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.session import get_db_session
from ...schemas.common import ApiResponse, PaginatedResponse
from ...schemas.document import (
    DocumentOut, DocumentUploadResponse, DocumentUpdate,
    DocumentImportUrlRequest, DocumentSearchQuery,
)
from .loaders import list_supported_extensions
from ...core.exceptions import to_http_exception, AppBaseException
from ...core.logging import log
from .service import IngestionService

router = APIRouter(prefix="/documents", tags=["数据摄入层 Documents"])

_service = IngestionService()


@router.post("/upload", response_model=ApiResponse[DocumentUploadResponse])
async def upload_document(
    file: UploadFile = File(..., description="待上传的文档文件"),
    tags: Optional[str] = Form(None, description="标签，逗号分隔"),
    db: AsyncSession = Depends(get_db_session),
):
    """上传本地文档并处理入库"""
    try:
        # 写入临时文件
        suffix = os.path.splitext(file.filename or "")[1] or ".bin"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            while chunk := await file.read(1 << 20):
                tmp.write(chunk)
            tmp_path = tmp.name
        try:
            tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
            result = await _service.ingest_uploaded_file(
                db=db, temp_path=tmp_path, original_filename=file.filename or "unnamed", tags=tag_list,
            )
        finally:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass
        return ApiResponse.success(result)
    except AppBaseException as e:
        log.exception("upload_document failed")
        raise to_http_exception(e)
    except Exception as e:
        log.exception("upload_document unexpected error")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/import-url", response_model=ApiResponse[DocumentUploadResponse])
async def import_url(payload: DocumentImportUrlRequest, db: AsyncSession = Depends(get_db_session)):
    """通过 URL 导入网页内容"""
    try:
        result = await _service.ingest_url(db=db, url=payload.url, title=payload.title, tags=payload.tags)
        return ApiResponse.success(result)
    except AppBaseException as e:
        log.exception("import_url failed")
        raise to_http_exception(e)
    except Exception as e:
        log.exception("import_url unexpected error")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=ApiResponse[PaginatedResponse[DocumentOut]])
async def list_documents(
    keyword: str = Query(default=""),
    file_type: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    db: AsyncSession = Depends(get_db_session),
):
    """分页查询文档列表"""
    try:
        q = DocumentSearchQuery(keyword=keyword, file_type=file_type, status=status, page=page, page_size=page_size)
        result = await _service.list_documents(db=db, query=q)
        return ApiResponse.success(result)
    except AppBaseException as e:
        raise to_http_exception(e)
    except Exception as e:
        log.exception("list_documents error")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/supported-extensions", response_model=ApiResponse[list[str]])
async def supported_extensions():
    """返回支持的文件扩展名列表"""
    from .loaders import list_supported_extensions
    return ApiResponse.success(list_supported_extensions())


@router.get("/{doc_id}", response_model=ApiResponse[DocumentOut])
async def get_document(doc_id: str, db: AsyncSession = Depends(get_db_session)):
    try:
        return ApiResponse.success(await _service.get_document(db, doc_id))
    except AppBaseException as e:
        raise to_http_exception(e)
    except Exception as e:
        log.exception(f"get_document {doc_id} error")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{doc_id}", response_model=ApiResponse[DocumentOut])
async def update_document(doc_id: str, update: DocumentUpdate, db: AsyncSession = Depends(get_db_session)):
    try:
        return ApiResponse.success(await _service.update_document(db, doc_id, update))
    except AppBaseException as e:
        raise to_http_exception(e)
    except Exception as e:
        log.exception(f"update_document {doc_id} error")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{doc_id}", response_model=ApiResponse[dict])
async def delete_document(doc_id: str, db: AsyncSession = Depends(get_db_session)):
    try:
        return ApiResponse.success(await _service.delete_document(db, doc_id))
    except AppBaseException as e:
        raise to_http_exception(e)
    except Exception as e:
        log.exception(f"delete_document {doc_id} error")
        raise HTTPException(status_code=500, detail=str(e))
