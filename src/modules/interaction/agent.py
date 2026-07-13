from __future__ import annotations

import json
import re
import time
import uuid
from typing import Optional, AsyncIterable
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.config import settings
from ...core.logging import log
from ...db.models.conversation import Conversation as DbConv, Message as DbMsg
from ...schemas.conversation import (
    ChatRequest, ChatResponse, Citation, ConversationOut, MessageOut,
)
from ...schemas.memory import UserProfileOut
from ...utils.text_utils import estimate_tokens, extract_snippet
from ...utils import utc_now
from ..memory.service import MemoryService
from ..processing.embedder import get_embedder
from .llm import get_llm_provider, BaseLLMProvider
from .retrieval import HybridRetriever, RetrievedChunk


_CITATION_RE = re.compile(r"\[ref:\s*(\d+)\]")


class RAGAgent:
    """RAG 核心编排器"""

    def __init__(self) -> None:
        self._retriever = HybridRetriever()
        self._llm: BaseLLMProvider = get_llm_provider()
        self._embedder = get_embedder()
        self._memory = MemoryService()

    # ========== Prompt 加载 ==========
    def _load_prompt(self, name: str) -> str:
        p = Path(settings.paths.prompts_dir) / f"{name}.yaml"
        if not p.exists():
            return ""
        try:
            import yaml
            with open(p, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
            return str(data.get("system", "") or data.get("human", "")).strip()
        except Exception as e:
            log.warning(f"加载 prompt {name} 失败: {e}")
            return ""

    # ========== RAG 生成 ==========
    def _build_context(self, chunks: list[RetrievedChunk],
                       profile: UserProfileOut,
                       history_msgs: list[DbMsg],
                       long_term: list[dict]) -> tuple[str, list[RetrievedChunk], str, str, str]:
        # 引用编号（从 1 开始）
        indexed: list[tuple[int, RetrievedChunk]] = list(enumerate(chunks, 1))
        context_lines = []
        for idx, c in indexed:
            snippet = c.content.strip().replace("\n", " ")[:800]
            context_lines.append(f"[{idx}] (来源: {c.doc_title or '未命名文档'}, 页 {c.page_num}) {snippet}")
        context_text = "\n\n".join(context_lines)
        if not context_text:
            context_text = "[EOF_NO_CONTEXT]\n  - 未检索到任何相关知识片段"

        # 画像
        profile_text = self._memory.format_profile_for_prompt(profile)

        # 短期记忆（会话历史）
        short_lines = []
        for m in history_msgs[-settings.memory.short_term_window:]:
            prefix = "用户" if m.role == "user" else "助手"
            short_lines.append(f"{prefix}: {m.content[:300]}")
        short_text = "\n".join(short_lines) if short_lines else "- 暂无历史对话"

        # 长期记忆
        long_lines = []
        for idx, m in enumerate(long_term[:settings.memory.long_term_top_k], 1):
            content = str(m.get("content", ""))[:300]
            long_lines.append(f"L{idx}. {content}")
        long_text = "\n".join(long_lines) if long_lines else "- 暂无长期记忆"

        return context_text, chunks, profile_text, short_text, long_text

    def _render_rag_prompt(self, query: str, context: str, profile: str,
                           short_term: str, long_term: str) -> tuple[str, str]:
        system = (
            "你是一个友好、专业的个人知识库助手。你只能基于提供的 Context 回答问题。\n"
            "要求：\n"
            "1. 用中文回答，语气自然专业\n"
            "2. 若 Context 中信息不足，明确说「根据当前知识库未找到相关内容」，不要编造\n"
            "3. 引用上下文时在对应句子末尾使用 [ref:N]，N 为上下文编号（从 1 开始）\n"
            "4. 结构清晰，适度使用分点"
        )
        user = (
            f"=== 用户画像 ===\n{profile}\n\n"
            f"=== 短期记忆（会话历史） ===\n{short_term}\n\n"
            f"=== 长期记忆（相关历史） ===\n{long_term}\n\n"
            f"=== 参考上下文（Context） ===\n{context}\n\n"
            f"=== 用户问题 ===\n{query}\n"
        )
        return system, user

    def _resolve_citations(self, answer: str, indexed_chunks: list[RetrievedChunk]) -> tuple[str, list[Citation]]:
        refs_map: dict[int, Citation] = {}
        def _sub(match):
            try:
                n = int(match.group(1))
            except Exception:
                return match.group(0)
            if 1 <= n <= len(indexed_chunks):
                c = indexed_chunks[n - 1]
                if n not in refs_map:
                    refs_map[n] = Citation(
                        index=n, doc_id=c.doc_id, doc_title=c.doc_title,
                        page_num=c.page_num, source_path=c.source_path,
                        snippet=extract_snippet(c.content, length=180),
                        score=c.score,
                    )
                return f"[{n}]"
            return ""

        cleaned = _CITATION_RE.sub(_sub, answer)
        citations = [refs_map[k] for k in sorted(refs_map.keys())]
        return cleaned, citations

    async def _load_conversation(self, db: AsyncSession, conv_id: Optional[str]) -> DbConv:
        if conv_id:
            stmt = select(DbConv).where(DbConv.id == conv_id)
            existing = (await db.execute(stmt)).scalar_one_or_none()
            if existing:
                return existing
        new_id = uuid.uuid4().hex[:16]
        conv = DbConv(id=new_id, title="新对话", msg_count=0)
        db.add(conv)
        await db.flush()
        return conv

    async def _append_message(self, db: AsyncSession, conv: DbConv, role: str,
                              content: str, refs: Optional[list[Citation]] = None,
                              tokens: int = 0, latency_ms: Optional[int] = None) -> DbMsg:
        conv.msg_count += 1
        seq_no = conv.msg_count
        conv.last_msg_at = utc_now()
        msg = DbMsg(
            id=uuid.uuid4().hex[:16], conv_id=conv.id, role=role,
            content=content,
            refs_json=json.dumps([r.model_dump() for r in refs], ensure_ascii=False) if refs else None,
            tokens_used=tokens, latency_ms=latency_ms,
            seq_no=seq_no,
        )
        db.add(msg)
        await db.flush()
        return msg

    async def chat(self, db: AsyncSession, req: ChatRequest) -> ChatResponse:
        start = time.perf_counter()
        # 1. 加载或创建会话
        conv = await self._load_conversation(db, req.conv_id)
        conv_id = conv.id

        # 2. 获取会话历史（短期记忆）
        history_stmt = select(DbMsg).where(DbMsg.conv_id == conv_id).order_by(DbMsg.seq_no)
        history_msgs = list((await db.execute(history_stmt)).scalars().all())

        # 3. 检索
        if req.mode == "pure_llm":
            chunks: list[RetrievedChunk] = []
        else:
            chunks = self._retriever.retrieve(
                req.query, top_k=(req.top_k or settings.retrieval.rerank_top_k) * 3,
            )
            # 过滤低于阈值
            chunks = [c for c in chunks if c.score >= settings.retrieval.score_threshold * 0.5]
            chunks = chunks[: settings.retrieval.rerank_top_k]

        # 拒答标记
        no_context = not chunks

        # 4. 画像 + 长期记忆
        profile = await self._memory.get_profile(db)
        long_term_memories: list[dict] = []
        try:
            if chunks:
                from ...db.vector_store import get_vector_store
                vs = get_vector_store()
                qv = self._embedder.embed_query(req.query)
                result = vs.search_memories(qv, top_k=settings.memory.long_term_top_k)
                ids = result.get("ids", [[]])[0]
                docs = result.get("documents", [[]])[0]
                metas = result.get("metadatas", [[]])[0]
                for i in range(len(ids)):
                    long_term_memories.append({
                        "id": ids[i],
                        "content": docs[i] if i < len(docs) else "",
                        "meta": metas[i] if i < len(metas) else {},
                    })
        except Exception as e:
            log.debug(f"长期记忆检索跳过: {e}")

        # 5. 写用户消息到 DB
        await self._append_message(db, conv, "user", req.query)

        # 6. LLM 生成
        context_text, indexed_chunks, profile_text, short_text, long_text = self._build_context(
            chunks, profile, history_msgs, long_term_memories,
        )
        if req.mode == "search_only":
            answer_lines = ["根据你的问题，我检索到以下相关知识片段：\n"]
            for i, c in enumerate(indexed_chunks, 1):
                snip = extract_snippet(c.content, length=200)
                answer_lines.append(f"{i}. **{c.doc_title or '未命名'}** (p.{c.page_num}, 相关度 {c.score:.2f})：\n   > {snip}\n")
            answer_lines.append(
                "\n如需生成完整回答，请将请求参数 mode 修改为 rag。"
                if req.mode == "search_only" else ""
            )
            answer_text = "\n".join(answer_lines)
        else:
            system_prompt, user_prompt = self._render_rag_prompt(
                req.query, context_text, profile_text, short_text, long_text,
            )
            answer_text = self._llm.generate(
                user_prompt, system_prompt=system_prompt,
                temperature=req.temperature,
            )
            if no_context and "未找到相关" not in answer_text and "不足" not in answer_text:
                if answer_text and len(answer_text) < 1000:
                    pass

        # 7. 解析引用
        answer_clean, citations = self._resolve_citations(answer_text, indexed_chunks)
        if no_context:
            # search_only 时不强加未找到提示
            pass

        # 8. 建议追问
        follow_ups = self._generate_follow_ups(req.query, indexed_chunks)
        latency = int((time.perf_counter() - start) * 1000)
        tokens = estimate_tokens(req.query) + estimate_tokens(answer_clean)

        # 9. 写助手消息
        await self._append_message(db, conv, "assistant", answer_clean, refs=citations,
                                   tokens=tokens, latency_ms=latency)
        # 更新会话标题（首条）
        if conv.msg_count <= 2:
            conv.title = req.query[:50]
        await db.commit()

        return ChatResponse(
            conv_id=conv.id,
            msg_id=uuid.uuid4().hex[:16],
            answer=answer_clean,
            citations=citations,
            follow_ups=follow_ups,
            tokens_used=tokens,
            latency_ms=latency,
            mode=req.mode,
        )

    async def chat_stream(self, db: AsyncSession, req: ChatRequest) -> AsyncIterable[dict]:
        """流式输出事件：phase / token / citations / done"""
        start = time.perf_counter()
        conv = await self._load_conversation(db, req.conv_id)
        conv_id = conv.id

        history_stmt = select(DbMsg).where(DbMsg.conv_id == conv_id).order_by(DbMsg.seq_no)
        history_msgs = list((await db.execute(history_stmt)).scalars().all())

        yield {"type": "chat.phase", "data": {"phase": "retrieving"}}

        # 检索
        if req.mode == "pure_llm":
            chunks: list[RetrievedChunk] = []
        else:
            chunks = self._retriever.retrieve(
                req.query, top_k=(req.top_k or settings.retrieval.rerank_top_k) * 3,
            )
            chunks = [c for c in chunks if c.score >= settings.retrieval.score_threshold * 0.5]
            chunks = chunks[: settings.retrieval.rerank_top_k]

        # 返回检索结果供前端展示
        def _to_dict(c: RetrievedChunk) -> dict:
            return {
                "chunk_id": c.chunk_id, "doc_id": c.doc_id,
                "doc_title": c.doc_title, "file_type": c.file_type,
                "page_num": c.page_num, "score": c.score,
                "snippet": extract_snippet(c.content, length=180),
            }
        yield {"type": "search.results", "data": {"chunks": [_to_dict(c) for c in chunks]}}

        profile = await self._memory.get_profile(db)
        long_term_memories: list[dict] = []
        try:
            if chunks:
                from ...db.vector_store import get_vector_store
                vs = get_vector_store()
                qv = self._embedder.embed_query(req.query)
                r = vs.search_memories(qv, top_k=settings.memory.long_term_top_k)
                ids = r.get("ids", [[]])[0]
                docs = r.get("documents", [[]])[0]
                for i in range(len(ids)):
                    long_term_memories.append({"id": ids[i], "content": docs[i] if i < len(docs) else ""})
        except Exception:
            pass

        await self._append_message(db, conv, "user", req.query)

        context_text, indexed_chunks, profile_text, short_text, long_text = self._build_context(
            chunks, profile, history_msgs, long_term_memories,
        )

        yield {"type": "chat.phase", "data": {"phase": "generating"}}

        system_prompt, user_prompt = self._render_rag_prompt(
            req.query, context_text, profile_text, short_text, long_text,
        )

        # 生成
        full_text_parts: list[str] = []
        async for token in self._llm.astream(
            user_prompt, system_prompt=system_prompt, temperature=req.temperature,
        ):
            full_text_parts.append(token)
            yield {"type": "chat.token", "data": {"token": token}}

        answer_full = "".join(full_text_parts)
        answer_clean, citations = self._resolve_citations(answer_full, indexed_chunks)
        yield {"type": "citations", "data": {"refs": [c.model_dump() for c in citations]}}

        follow_ups = self._generate_follow_ups(req.query, indexed_chunks)
        yield {"type": "follow_ups", "data": {"questions": follow_ups}}

        latency = int((time.perf_counter() - start) * 1000)
        tokens = estimate_tokens(req.query) + estimate_tokens(answer_clean)

        await self._append_message(db, conv, "assistant", answer_clean, refs=citations,
                                   tokens=tokens, latency_ms=latency)
        if conv.msg_count <= 2:
            conv.title = req.query[:50]
        await db.commit()

        yield {"type": "chat.done", "data": {
            "msg_id": uuid.uuid4().hex[:16], "conv_id": conv.id,
            "tokens": tokens, "latency_ms": latency, "answer": answer_clean,
        }}

    # ========== 辅助方法 ==========
    def _generate_follow_ups(self, query: str, chunks: list[RetrievedChunk]) -> list[str]:
        """启发式生成 3 个追问"""
        qs: list[str] = []
        if not chunks:
            return [
                "推荐一些我可以上传的文档类型？",
                "如何批量导入我的本地文件夹？",
                "除了本地文件，还能接入哪些数据源？",
            ]
        # 基于 Top chunks 提取关键词 + 问题模板
        import hashlib
        seed = int(hashlib.md5(query.encode("utf-8")).hexdigest()[:8], 16)
        top = chunks[:3]
        keywords_pool: set[str] = set()
        for c in top:
            text = c.content
            for term in re.findall(r"[\u4e00-\u9fffA-Za-z0-9]{2,12}", text):
                keywords_pool.add(term)
        kw_list = sorted(keywords_pool, key=lambda x: -len(x))[:10]
        templates = [
            lambda kw: f"进一步说明「{kw}」的核心要点是什么？",
            lambda kw: f"如何应用「{kw}」到实际工作场景？",
            lambda kw: f"「{kw}」有哪些常见的误区或最佳实践？",
            lambda kw: f"和「{kw}」相关的概念还有哪些？",
            lambda kw: f"请对比一下「{kw}」与同类方案的差异？",
        ]
        used = set()
        for i in range(3):
            template = templates[(seed + i) % len(templates)]
            if kw_list:
                kw = kw_list[(seed + i * 3) % len(kw_list)]
                q = template(kw)
                if q not in used:
                    used.add(q)
                    qs.append(q)
                    continue
            qs.append(f"关于「{query[:20]}」，还能补充哪些细节？")
        return qs[:3]
