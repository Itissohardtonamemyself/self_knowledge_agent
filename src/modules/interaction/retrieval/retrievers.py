from __future__ import annotations

import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional

from ....core.config import settings
from ....core.logging import log
from ....db.vector_store import get_vector_store
from ....db.cache import get_cache
from ....modules.processing.embedder import get_embedder
from ....schemas.conversation import SearchHit


@dataclass
class RetrievedChunk:
    chunk_id: str
    doc_id: str
    doc_title: str
    content: str
    page_num: int
    file_type: str
    source_path: str
    score: float = 0.0
    metadata: dict = field(default_factory=dict)


class BaseRetriever(ABC):
    @abstractmethod
    def retrieve(self, query: str, top_k: Optional[int] = None,
                 where: Optional[dict] = None) -> list[RetrievedChunk]:
        ...


class VectorRetriever(BaseRetriever):
    def __init__(self) -> None:
        self._embedder = get_embedder()
        self._vs = get_vector_store()

    def retrieve(self, query: str, top_k: Optional[int] = None,
                 where: Optional[dict] = None,
                 query_vec: Optional[list[float]] = None) -> list[RetrievedChunk]:
        k = top_k or settings.retrieval.vector_top_k
        qv = query_vec if query_vec is not None else self._embedder.embed_query(query)
        result = self._vs.search_chunks(qv, top_k=k, where=where)
        chunks: list[RetrievedChunk] = []
        ids = result.get("ids", [[]])[0]
        docs = result.get("documents", [[]])[0]
        metas = result.get("metadatas", [[]])[0]
        dists = result.get("distances", [[]])[0]
        for idx in range(len(ids)):
            m = metas[idx] if idx < len(metas) else {}
            score = 1.0 - float(dists[idx]) if idx < len(dists) else 0.0
            chunks.append(RetrievedChunk(
                chunk_id=str(m.get("chunk_id") or ids[idx]),
                doc_id=str(m.get("doc_id") or ""),
                doc_title=str(m.get("title") or ""),
                content=docs[idx] if idx < len(docs) else "",
                page_num=int(m.get("page_num") or 0),
                file_type=str(m.get("file_type") or ""),
                source_path=str(m.get("source_path") or ""),
                score=max(0.0, min(1.0, score)),
                metadata=m,
            ))
        return chunks


class KeywordRetriever(BaseRetriever):
    """简易关键词检索（SQLite LIKE 模糊匹配），MVP 版本"""

    def retrieve(self, query: str, top_k: Optional[int] = None,
                 where: Optional[dict] = None) -> list[RetrievedChunk]:
        import asyncio
        try:
            loop = asyncio.get_event_loop()
        except Exception:
            loop = None
        coro = self._async_retrieve(query, top_k=top_k)
        if loop and loop.is_running():
            # 运行时已有 loop（FastAPI 场景），退化为空列表
            return []
        return asyncio.run(coro)

    async def _async_retrieve(self, query: str, top_k: Optional[int] = None) -> list[RetrievedChunk]:
        from sqlalchemy import select, text
        from ....db.session import get_session_factory
        from ....db.models.document import Chunk as DbChunk, Document as DbDoc
        k = top_k or settings.retrieval.vector_top_k
        factory = get_session_factory()
        keywords = [w.strip() for w in query.replace("，", " ").replace(",", " ").split() if w.strip()]
        if not keywords:
            return []
        async with factory() as session:
            stmt = select(DbChunk, DbDoc).join(DbDoc, DbChunk.doc_id == DbDoc.id)
            for kw in keywords:
                stmt = stmt.where(DbChunk.content.like(f"%{kw}%"))
            stmt = stmt.order_by(text("length(chunks.content) ASC")).limit(k * 2)
            rows = (await session.execute(stmt)).all()
        results: list[RetrievedChunk] = []
        seen = set()
        for c, d in rows:
            if c.id in seen:
                continue
            seen.add(c.id)
            # 简单打分：命中的关键词比例
            hit = sum(1 for kw in keywords if kw in c.content)
            score = hit / max(1, len(keywords))
            results.append(RetrievedChunk(
                chunk_id=c.id, doc_id=c.doc_id, doc_title=d.title,
                content=c.content, page_num=c.page_num, file_type=d.file_type,
                source_path=d.source_path, score=min(1.0, score),
            ))
        results.sort(key=lambda x: -x.score)
        return results[:k]


class HybridRetriever(BaseRetriever):
    """混合检索：向量 + 关键词 RRF 融合"""

    def __init__(self) -> None:
        self._vec = VectorRetriever()
        self._kw = KeywordRetriever()

    def retrieve(self, query: str, top_k: Optional[int] = None,
                 where: Optional[dict] = None,
                 query_vec: Optional[list[float]] = None) -> list[RetrievedChunk]:
        start = time.perf_counter()
        k = top_k or settings.retrieval.rerank_top_k * 3

        s = time.perf_counter()
        vec_results = self._vec.retrieve(query, top_k=max(k, 20), query_vec=query_vec)
        vec_time = (time.perf_counter() - s) * 1000
        log.info(f"[RETRIEVE] 向量检索: {vec_time:.2f}ms, results={len(vec_results)}, top_k={max(k, 20)}, query_vec_provided={query_vec is not None}")

        s = time.perf_counter()
        kw_results = self._kw.retrieve(query, top_k=max(k, 20))
        kw_time = (time.perf_counter() - s) * 1000
        log.info(f"[RETRIEVE] 关键词检索: {kw_time:.2f}ms, results={len(kw_results)}, top_k={max(k, 20)}")

        s = time.perf_counter()
        # RRF 融合
        k_rrf = 60
        merged: dict[str, tuple[float, RetrievedChunk]] = {}

        def _merge(rank: int, chunk: RetrievedChunk):
            score_add = 1.0 / (k_rrf + rank + 1)
            key = chunk.chunk_id
            if key in merged:
                cur_score, cur = merged[key]
                # 合并 score 和元数据
                merged[key] = (cur_score + score_add, cur)
            else:
                merged[key] = (score_add, chunk)

        for rank, c in enumerate(vec_results):
            _merge(rank, c)
        for rank, c in enumerate(kw_results):
            _merge(rank, c)

        sorted_chunks = sorted(merged.values(), key=lambda x: -x[0])
        # 归一化 score 到 [0,1]
        out: list[RetrievedChunk] = []
        if sorted_chunks:
            max_s = sorted_chunks[0][0] or 1.0
            for s_val, c in sorted_chunks[:k]:
                c.score = s_val / max_s
                out.append(c)

        merge_time = (time.perf_counter() - s) * 1000
        total_time = (time.perf_counter() - start) * 1000
        log.info(f"[RETRIEVE] RRF融合: {merge_time:.2f}ms, 最终结果={len(out)}, 总耗时={total_time:.2f}ms")

        return out


def _to_search_hit(r: RetrievedChunk) -> SearchHit:
    return SearchHit(
        chunk_id=r.chunk_id, doc_id=r.doc_id, doc_title=r.doc_title,
        content=r.content[:500], page_num=r.page_num,
        score=r.score, file_type=r.file_type,
    )
