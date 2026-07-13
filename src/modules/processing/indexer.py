from __future__ import annotations

from typing import Optional

from ...core.logging import log
from ...db.vector_store import get_vector_store
from ...schemas.document import ChunkInfo
from .embedder import get_embedder


class Indexer:
    """向量索引构建与维护"""

    def __init__(self) -> None:
        self._embedder = get_embedder()
        self._vs = get_vector_store()

    def index_chunks(self, chunks: list[ChunkInfo], doc_info: Optional[dict] = None) -> int:
        if not chunks:
            return 0
        doc_info = doc_info or {}
        texts = [c.content for c in chunks]
        embeddings = self._embedder.embed_documents(texts)
        ids = [c.id for c in chunks]
        metadatas: list[dict] = []
        for c in chunks:
            metadatas.append({
                "doc_id": doc_info.get("doc_id", c.doc_id),
                "chunk_id": c.id,
                "file_type": doc_info.get("file_type", "unknown"),
                "title": doc_info.get("title", "")[:128],
                "tags": ",".join(doc_info.get("tags", []) or []),
                "page_num": int(c.page_num),
                "position_idx": int(c.position_idx),
                "token_count": int(c.token_count),
                "source_path": (doc_info.get("source_path") or "")[:256],
            })
        self._vs.upsert_chunks(ids=ids, embeddings=embeddings, documents=texts, metadatas=metadatas)
        log.info(f"索引完成 {len(chunks)} 个 chunk，向量维度 {len(embeddings[0]) if embeddings else 0}")
        return len(chunks)
