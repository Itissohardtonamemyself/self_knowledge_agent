from __future__ import annotations

import json
import shutil
from datetime import datetime
from typing import Optional
from pathlib import Path
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.config import settings
from ...core.logging import log
from ...core.exceptions import DocumentNotFoundError, DocumentProcessingError
from ...db.models.document import Document as DbDocument, Chunk as DbChunk
from ...schemas.common import PaginatedResponse, Pagination
from ...schemas.document import (
    RawDocument, DocumentCreate, DocumentUpdate, DocumentOut, ChunkInfo,
    DocumentUploadResponse, DocumentSearchQuery,
)
from ...utils.file_utils import ensure_dir, get_file_hash, unique_path, safe_filename
from .loaders import get_loader_for_filename, WebLoader
from .preprocessor import DocumentPreprocessor, ChunkedDocument


class IngestionService:
    """文档摄入服务"""

    def __init__(self) -> None:
        self._preprocessor = DocumentPreprocessor()

    async def ingest_uploaded_file(
        self, db: AsyncSession, temp_path: str, original_filename: str,
        tags: Optional[list[str]] = None, doc_id: Optional[str] = None,
    ) -> DocumentUploadResponse:
        # 1. 复制到用户数据目录
        ensure_dir(settings.paths.documents_dir)
        dest = unique_path(settings.paths.documents_dir, safe_filename(original_filename))
        try:
            shutil.copy2(temp_path, dest)
        except Exception as e:
            raise DocumentProcessingError(f"保存文件失败: {e}") from e

        # 2. 解析
        loader = get_loader_for_filename(dest)
        raw: RawDocument = loader.load(dest, doc_id=doc_id)
        if tags:
            # 暂存 tags 到 metadata
            raw.metadata["tags"] = tags

        return await self._persist_document(db, raw, tags=tags)

    async def ingest_url(self, db: AsyncSession, url: str, title: Optional[str] = None,
                         tags: Optional[list[str]] = None) -> DocumentUploadResponse:
        loader = WebLoader()
        raw = loader.load_from_url(url=url, title=title)
        # 保存 html 快照
        try:
            ensure_dir(settings.paths.documents_dir)
            html_path = unique_path(
                settings.paths.documents_dir,
                safe_filename(title or raw.doc_id) + ".html",
            )
            from urllib.parse import urlparse
            import httpx
            with httpx.Client(follow_redirects=True, timeout=30) as c:
                resp = c.get(url)
                Path(html_path).write_text(resp.text, encoding="utf-8", errors="ignore")
                raw.source_path = html_path
                raw.file_size = len(resp.content)
        except Exception:
            pass
        return await self._persist_document(db, raw, tags=tags)

    async def _persist_document(
        self, db: AsyncSession, raw: RawDocument, tags: Optional[list[str]] = None,
    ) -> DocumentUploadResponse:
        # 1. 查重
        stmt = select(DbDocument).where(DbDocument.id == raw.doc_id)
        existing = (await db.execute(stmt)).scalar_one_or_none()
        if existing:
            # 删除旧 chunks（含向量库）
            await self._delete_doc_cascade(db, existing.id)

        # 2. 预处理 + 分块
        chunked: ChunkedDocument = self._preprocessor.process(raw)

        # 3. 写 DB 主记录
        doc = DbDocument(
            id=raw.doc_id,
            source_path=raw.source_path,
            title=raw.title or Path(raw.source_path).stem,
            file_type=raw.file_type,
            file_size=raw.file_size,
            chunk_count=len(chunked.chunks),
            tags_json=json.dumps(tags or [], ensure_ascii=False),
            source_url=raw.source_url,
            status="completed",
            error_msg=None,
        )
        db.add(doc)
        await db.flush()

        # 4. 写 chunks 表
        for c in chunked.chunks:
            db_chunk = DbChunk(
                id=c.id,
                doc_id=c.doc_id,
                content=c.content,
                page_num=c.page_num,
                char_start=0,
                char_end=len(c.content),
                token_count=c.token_count,
                position_idx=c.position_idx,
            )
            db.add(db_chunk)
        await db.flush()

        # 5. 触发向量化（模块二）
        try:
            from ..processing.service import ProcessingService
            ProcessingService().index_chunks(chunked.chunks, doc_info={
                "doc_id": doc.id, "file_type": doc.file_type, "title": doc.title,
                "tags": tags or [], "source_path": doc.source_path,
            })
        except Exception as e:
            log.error(f"向量化失败，文档状态标记为 processing: {e}")
            doc.status = "processing"
            doc.error_msg = str(e)[:200]

        await db.commit()
        log.info(f"文档入库成功: {doc.id} -> {doc.title}, chunks={doc.chunk_count}")
        return DocumentUploadResponse(
            doc_id=doc.id,
            status=doc.status,
            title=doc.title,
            file_type=doc.file_type,
            file_size=doc.file_size,
            chunk_count=doc.chunk_count,
        )

    async def list_documents(self, db: AsyncSession, query: DocumentSearchQuery) -> PaginatedResponse[DocumentOut]:
        q = select(DbDocument)
        count_q = select(func.count(DbDocument.id))
        if query.keyword:
            like = f"%{query.keyword}%"
            q = q.where(DbDocument.title.like(like))
            count_q = count_q.where(DbDocument.title.like(like))
        if query.file_type:
            q = q.where(DbDocument.file_type == query.file_type)
            count_q = count_q.where(DbDocument.file_type == query.file_type)
        if query.status:
            q = q.where(DbDocument.status == query.status)
            count_q = count_q.where(DbDocument.status == query.status)

        total = (await db.execute(count_q)).scalar_one() or 0
        offset = (query.page - 1) * query.page_size
        q = q.order_by(DbDocument.created_at.desc()).offset(offset).limit(query.page_size)
        items = (await db.execute(q)).scalars().all()

        outs: list[DocumentOut] = []
        for d in items:
            tags = []
            try:
                tags = json.loads(d.tags_json) if d.tags_json else []
            except Exception:
                pass
            outs.append(DocumentOut(
                id=d.id, source_path=d.source_path, title=d.title,
                file_type=d.file_type, file_size=d.file_size, chunk_count=d.chunk_count,
                tags=tags, summary=d.summary, source_url=d.source_url,
                status=d.status, error_msg=d.error_msg,
                created_at=d.created_at, updated_at=d.updated_at,
            ))
        total_pages = (total + query.page_size - 1) // query.page_size if query.page_size > 0 else 0
        return PaginatedResponse(
            items=outs,
            pagination=Pagination(total=total, page=query.page, page_size=query.page_size, total_pages=total_pages),
        )

    async def get_document(self, db: AsyncSession, doc_id: str) -> DocumentOut:
        stmt = select(DbDocument).where(DbDocument.id == doc_id)
        d = (await db.execute(stmt)).scalar_one_or_none()
        if not d:
            raise DocumentNotFoundError()
        tags: list[str] = []
        try:
            tags = json.loads(d.tags_json) if d.tags_json else []
        except Exception:
            pass
        return DocumentOut(
            id=d.id, source_path=d.source_path, title=d.title,
            file_type=d.file_type, file_size=d.file_size, chunk_count=d.chunk_count,
            tags=tags, summary=d.summary, source_url=d.source_url,
            status=d.status, error_msg=d.error_msg,
            created_at=d.created_at, updated_at=d.updated_at,
        )

    async def update_document(self, db: AsyncSession, doc_id: str, update: DocumentUpdate) -> DocumentOut:
        stmt = select(DbDocument).where(DbDocument.id == doc_id)
        d = (await db.execute(stmt)).scalar_one_or_none()
        if not d:
            raise DocumentNotFoundError()
        if update.title is not None:
            d.title = update.title
        if update.tags is not None:
            d.tags_json = json.dumps(update.tags, ensure_ascii=False)
        if update.summary is not None:
            d.summary = update.summary
        d.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(d)
        return await self.get_document(db, doc_id)

    async def delete_document(self, db: AsyncSession, doc_id: str) -> dict:
        stmt = select(DbDocument).where(DbDocument.id == doc_id)
        d = (await db.execute(stmt)).scalar_one_or_none()
        if not d:
            raise DocumentNotFoundError()
        await self._delete_doc_cascade(db, doc_id)
        await db.delete(d)
        await db.commit()
        # 尝试删除源文件（可选）
        try:
            if d.source_path and Path(d.source_path).exists():
                try:
                    Path(d.source_path).unlink(missing_ok=True)
                except Exception:
                    pass
        except Exception:
            pass
        return {"doc_id": doc_id, "deleted": True}

    async def _delete_doc_cascade(self, db: AsyncSession, doc_id: str) -> None:
        # 向量库
        try:
            from ...db.vector_store import get_vector_store
            get_vector_store().delete_chunks_by_doc_id(doc_id)
        except Exception as e:
            log.warning(f"删除向量库条目失败 doc_id={doc_id}: {e}")
        await db.execute(delete(DbChunk).where(DbChunk.doc_id == doc_id))
        await db.flush()
