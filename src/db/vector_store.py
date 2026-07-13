from __future__ import annotations

from typing import Optional
from pathlib import Path
from functools import lru_cache

from ..core.config import settings
from ..core.logging import log
from ..core.exceptions import VectorStoreError


class VectorStore:
    """Chroma 向量数据库封装"""

    def __init__(self) -> None:
        self._client = None
        self._chunks_collection = None
        self._memory_collection = None
        self._init_client()

    def _init_client(self) -> None:
        try:
            import chromadb
            from chromadb.config import Settings as ChromaSettings
        except ImportError as e:  # pragma: no cover
            raise VectorStoreError(f"ChromaDB 未安装，请先安装 chromadb: {e}")

        persist_dir = settings.vector_store.chroma_persist_dir
        Path(persist_dir).mkdir(parents=True, exist_ok=True)

        try:
            self._client = chromadb.PersistentClient(
                path=persist_dir,
                settings=ChromaSettings(anonymized_telemetry=False),
            )
        except Exception as e:
            log.warning(f"PersistentClient 初始化失败，退化为 EphemeralClient: {e}")
            self._client = chromadb.Client(ChromaSettings(anonymized_telemetry=False))

        self._chunks_collection = self._client.get_or_create_collection(
            name=settings.vector_store.default_collection,
            metadata={"hnsw:space": "cosine", "description": "知识块向量"},
        )
        self._memory_collection = self._client.get_or_create_collection(
            name=settings.vector_store.memory_collection,
            metadata={"hnsw:space": "cosine", "description": "长期记忆向量"},
        )
        log.info("Chroma 向量库初始化完成")

    # === Chunks ===
    def upsert_chunks(self, ids: list[str], embeddings: list[list[float]],
                      documents: list[str], metadatas: list[dict]) -> None:
        if not ids:
            return
        try:
            self._chunks_collection.upsert(
                ids=ids, embeddings=embeddings, documents=documents, metadatas=metadatas,
            )
        except Exception as e:
            raise VectorStoreError(f"Upsert chunks 失败: {e}") from e

    def search_chunks(self, query_embedding: list[float], top_k: Optional[int] = None,
                      where: Optional[dict] = None) -> dict:
        k = top_k or settings.retrieval.vector_top_k
        try:
            return self._chunks_collection.query(
                query_embeddings=[query_embedding],
                n_results=min(k, max(1, self._chunks_collection.count())),
                where=where,
                include=["documents", "metadatas", "distances"],
            )
        except Exception as e:
            raise VectorStoreError(f"Search chunks 失败: {e}") from e

    def delete_chunks(self, ids: list[str]) -> None:
        if not ids:
            return
        try:
            self._chunks_collection.delete(ids=ids)
        except Exception as e:
            raise VectorStoreError(f"Delete chunks 失败: {e}") from e

    def delete_chunks_by_doc_id(self, doc_id: str) -> None:
        try:
            self._chunks_collection.delete(where={"doc_id": doc_id})
        except Exception as e:
            log.warning(f"按 doc_id 删除 chunk 失败（可能为空）：{e}")

    def count_chunks(self) -> int:
        try:
            return self._chunks_collection.count()
        except Exception:
            return 0

    # === Memory ===
    def upsert_memories(self, ids: list[str], embeddings: list[list[float]],
                        documents: list[str], metadatas: list[dict]) -> None:
        if not ids:
            return
        try:
            self._memory_collection.upsert(
                ids=ids, embeddings=embeddings, documents=documents, metadatas=metadatas,
            )
        except Exception as e:
            raise VectorStoreError(f"Upsert memories 失败: {e}") from e

    def search_memories(self, query_embedding: list[float], top_k: Optional[int] = None) -> dict:
        k = top_k or settings.memory.long_term_top_k
        try:
            cnt = self._memory_collection.count()
            if cnt == 0:
                return {"ids": [[]], "documents": [[]], "metadatas": [[]], "distances": [[]]}
            return self._memory_collection.query(
                query_embeddings=[query_embedding],
                n_results=min(k, cnt),
                include=["documents", "metadatas", "distances"],
            )
        except Exception as e:
            raise VectorStoreError(f"Search memories 失败: {e}") from e


@lru_cache(maxsize=1)
def get_vector_store() -> VectorStore:
    return VectorStore()
