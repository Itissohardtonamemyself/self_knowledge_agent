from __future__ import annotations

import json
import time
from datetime import datetime
from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.models.conversation import Conversation as DbConv, Message as DbMsg
from ...schemas.conversation import (
    ChatRequest, ChatResponse, ConversationCreate, ConversationOut, MessageOut,
    SimpleSearchRequest, SearchHit, Citation,
)
from ...core.logging import log
from ...core.config import settings
from .agent import RAGAgent
from .retrieval import HybridRetriever, _to_search_hit


class InteractionService:
    _agent: RAGAgent | None = None
    _retriever: HybridRetriever | None = None

    @classmethod
    def agent(cls) -> RAGAgent:
        if cls._agent is None:
            cls._agent = RAGAgent()
        return cls._agent

    @classmethod
    def retriever(cls) -> HybridRetriever:
        if cls._retriever is None:
            cls._retriever = HybridRetriever()
        return cls._retriever

    async def chat(self, db: AsyncSession, req: ChatRequest) -> ChatResponse:
        return await self.agent().chat(db, req)

    async def chat_stream(self, db: AsyncSession, req: ChatRequest):
        async for event in self.agent().chat_stream(db, req):
            yield event

    async def list_conversations(self, db: AsyncSession, page: int, page_size: int) -> dict:
        total_q = select(func.count(DbConv.id))
        total = (await db.execute(total_q)).scalar_one() or 0
        q = select(DbConv).order_by(DbConv.last_msg_at.desc())
        q = q.offset((page - 1) * page_size).limit(page_size)
        items = (await db.execute(q)).scalars().all()
        outs = [ConversationOut.model_validate(m, from_attributes=True) for m in items]
        total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0
        return {
            "items": outs,
            "pagination": {"total": total, "page": page, "page_size": page_size, "total_pages": total_pages},
        }

    async def create_conversation(self, db: AsyncSession, create: ConversationCreate) -> ConversationOut:
        import uuid
        conv = DbConv(
            id=uuid.uuid4().hex[:16],
            title=create.title or "新对话",
            msg_count=0,
        )
        db.add(conv)
        await db.commit()
        await db.refresh(conv)
        return ConversationOut.model_validate(conv, from_attributes=True)

    async def delete_conversation(self, db: AsyncSession, conv_id: str) -> dict:
        stmt = select(DbConv).where(DbConv.id == conv_id)
        conv = (await db.execute(stmt)).scalar_one_or_none()
        if not conv:
            from ...core.exceptions import DocumentNotFoundError
            raise DocumentNotFoundError("会话不存在")
        await db.delete(conv)
        await db.commit()
        return {"conv_id": conv_id, "deleted": True}

    async def list_messages(self, db: AsyncSession, conv_id: str, page: int = 1,
                            page_size: int = 100) -> dict:
        total_q = select(func.count(DbMsg.id)).where(DbMsg.conv_id == conv_id)
        total = (await db.execute(total_q)).scalar_one() or 0
        q = select(DbMsg).where(DbMsg.conv_id == conv_id).order_by(DbMsg.seq_no)
        q = q.offset((page - 1) * page_size).limit(page_size)
        rows = (await db.execute(q)).scalars().all()
        outs: list[MessageOut] = []
        for m in rows:
            refs: list[Citation] = []
            if m.refs_json:
                try:
                    refs = [Citation(**r) for r in json.loads(m.refs_json)]
                except Exception:
                    pass
            outs.append(MessageOut(
                id=m.id, conv_id=m.conv_id, role=m.role, content=m.content,
                refs=refs, tokens_used=m.tokens_used, latency_ms=m.latency_ms,
                created_at=m.created_at, seq_no=m.seq_no,
            ))
        return {"items": outs, "pagination": {"total": total, "page": page, "page_size": page_size}}

    def simple_search(self, req: SimpleSearchRequest) -> list[SearchHit]:
        chunks = self.retriever().retrieve(req.q, top_k=req.top_k)
        if req.file_type:
            chunks = [c for c in chunks if c.file_type == req.file_type]
        return [_to_search_hit(c) for c in chunks]

    async def health_stats(self, db: AsyncSession) -> dict:
        from ...db.models.document import Document as DbDoc, Chunk as DbChunk
        from ...db.vector_store import get_vector_store
        try:
            docs = (await db.execute(select(func.count(DbDoc.id)))).scalar_one() or 0
            chunks = (await db.execute(select(func.count(DbChunk.id)))).scalar_one() or 0
        except Exception:
            docs = 0
            chunks = 0
        try:
            vs_chunks = get_vector_store().count_chunks()
        except Exception:
            vs_chunks = 0
        try:
            convs = (await db.execute(select(func.count(DbConv.id)))).scalar_one() or 0
        except Exception:
            convs = 0
        return {
            "documents": int(docs),
            "chunks_db": int(chunks),
            "chunks_vector": int(vs_chunks),
            "conversations": int(convs),
            "embedder_provider": settings.embedder.provider,
            "llm_provider": settings.llm.provider,
        }
