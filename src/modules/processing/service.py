from __future__ import annotations

from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.config import settings
from ...core.logging import log
from ...db.models.document import Document as DbDocument, Chunk as DbChunk
from ...schemas.document import ChunkInfo
from .embedder import get_embedder
from .indexer import Indexer


class ProcessingService:
    _indexer: Indexer | None = None

    @classmethod
    def _get_indexer(cls) -> Indexer:
        if cls._indexer is None:
            cls._indexer = Indexer()
        return cls._indexer

    def index_chunks(self, chunks: list[ChunkInfo], doc_info: Optional[dict] = None) -> int:
        return self._get_indexer().index_chunks(chunks, doc_info=doc_info)

    async def reindex_document(self, db: AsyncSession, doc_id: str) -> dict:
        """为单个文档重建索引"""
        stmt = select(DbDocument).where(DbDocument.id == doc_id)
        doc = (await db.execute(stmt)).scalar_one_or_none()
        if not doc:
            from ...core.exceptions import DocumentNotFoundError
            raise DocumentNotFoundError()
        # 清理旧向量
        from ...db.vector_store import get_vector_store
        get_vector_store().delete_chunks_by_doc_id(doc_id)

        stmt_chunks = select(DbChunk).where(DbChunk.doc_id == doc_id).order_by(DbChunk.position_idx)
        chunk_rows = (await db.execute(stmt_chunks)).scalars().all()
        chunks = [
            ChunkInfo(
                id=c.id, doc_id=c.doc_id, content=c.content,
                page_num=c.page_num, position_idx=c.position_idx, token_count=c.token_count,
            )
            for c in chunk_rows
        ]
        n = self.index_chunks(chunks, doc_info={
            "doc_id": doc.id, "file_type": doc.file_type, "title": doc.title,
            "source_path": doc.source_path,
        })
        doc.status = "completed"
        doc.error_msg = None
        await db.commit()
        return {"doc_id": doc_id, "indexed": n}

    async def reindex_all(self, db: AsyncSession, incremental: bool = True) -> dict:
        """全量/增量重建索引"""
        if not incremental:
            log.warning("全量重建索引：清空向量库")
            from ...db.vector_store import get_vector_store
            vs = get_vector_store()
            # 按 doc 逐个删除，避免 Chroma delete all 的问题
            total_docs = (await db.execute(select(func.count(DbDocument.id)))).scalar_one() or 0
        else:
            total_docs = 0

        stmt = select(DbDocument)
        docs = (await db.execute(stmt)).scalars().all()
        success = 0
        failed = 0
        for d in docs:
            try:
                await self.reindex_document(db, d.id)
                success += 1
            except Exception as e:
                failed += 1
                log.error(f"重建索引失败 doc_id={d.id}: {e}")
        return {
            "total": len(docs), "success": success, "failed": failed,
            "incremental": incremental,
        }

    def embed_query(self, text: str) -> list[float]:
        return get_embedder().embed_query(text)
