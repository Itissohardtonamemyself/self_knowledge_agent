from __future__ import annotations

import json
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ...core.config import settings
from ...core.logging import log
from ...core.security import encrypt_text, mask_sensitive
from ...db.models.document import Document as DbDoc, Chunk as DbChunk
from ...db.models.conversation import Conversation as DbConv, Message as DbMsg
from ...db.models.user_profile import UserProfile as DbProfile
from ...db.models.memory import LongTermMemory as DbLTM


class PrivacyService:
    def mask(self, text: str) -> str:
        return mask_sensitive(text)

    async def export_all(self, db: AsyncSession, export_dir: str | None = None) -> dict:
        """一键导出所有用户数据为标准 JSON + 原始文档 ZIP"""
        target_dir = Path(export_dir or settings.paths.data_dir) / "exports"
        target_dir.mkdir(parents=True, exist_ok=True)
        ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        export_path = target_dir / f"export_{ts}.zip"

        docs = (await db.execute(select(DbDoc))).scalars().all()
        chunks = (await db.execute(select(DbChunk))).scalars().all()
        convs = (await db.execute(select(DbConv))).scalars().all()
        msgs = (await db.execute(select(DbMsg))).scalars().all()
        profiles = (await db.execute(select(DbProfile))).scalars().all()
        ltms = (await db.execute(select(DbLTM))).scalars().all()

        data = {
            "exported_at": ts,
            "version": "0.1.0",
            "user_profile": [{
                "occupation": p.occupation,
                "domains": json.loads(p.domains_json) if p.domains_json else [],
                "preferences": json.loads(p.preferences_json) if p.preferences_json else {},
                "auto_update": p.auto_update,
                "custom_prompt": p.custom_prompt,
                "updated_at": p.updated_at.isoformat() if p.updated_at else None,
            } for p in profiles],
            "documents": [{
                "id": d.id, "title": d.title, "file_type": d.file_type,
                "source_path": d.source_path, "source_url": d.source_url,
                "file_size": d.file_size, "chunk_count": d.chunk_count,
                "tags": json.loads(d.tags_json) if d.tags_json else [],
                "summary": d.summary, "status": d.status,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            } for d in docs],
            "chunks": [{
                "id": c.id, "doc_id": c.doc_id, "content": c.content,
                "page_num": c.page_num, "position_idx": c.position_idx,
                "token_count": c.token_count,
            } for c in chunks],
            "conversations": [{
                "id": c.id, "title": c.title, "msg_count": c.msg_count,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            } for c in convs],
            "messages": [{
                "id": m.id, "conv_id": m.conv_id, "role": m.role, "content": m.content,
                "refs": json.loads(m.refs_json) if m.refs_json else [],
                "tokens_used": m.tokens_used, "latency_ms": m.latency_ms,
                "created_at": m.created_at.isoformat() if m.created_at else None,
                "seq_no": m.seq_no,
            } for m in msgs],
            "long_term_memories": [{
                "id": m.id, "content": m.content, "source_type": m.source_type,
                "importance_score": m.importance_score, "tags": json.loads(m.tags_json) if m.tags_json else [],
                "access_count": m.access_count, "status": m.status,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            } for m in ltms],
        }

        with tempfile.TemporaryDirectory() as td:
            tmpdir = Path(td)
            json_path = tmpdir / "data.json"
            json_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            # 附加原始文档
            docs_dir = tmpdir / "documents"
            docs_dir.mkdir()
            for d in docs:
                try:
                    sp = Path(d.source_path)
                    if sp.exists() and sp.is_file():
                        import shutil
                        shutil.copy2(sp, docs_dir / (d.id + "_" + Path(sp.name if sp.name else "file")))
                except Exception:
                    pass
            with zipfile.ZipFile(export_path, "w", zipfile.ZIP_DEFLATED) as zf:
                for f in (tmpdir.rglob("*")):
                    if f.is_file():
                        zf.write(f, f.relative_to(tmpdir))
        size = export_path.stat().st_size
        return {
            "file": str(export_path),
            "size_bytes": size,
            "counts": {
                "documents": len(docs),
                "chunks": len(chunks),
                "conversations": len(convs),
                "messages": len(msgs),
                "long_term_memories": len(ltms),
            },
        }

    async def wipe_all(self, db: AsyncSession, confirm: bool = False) -> dict:
        """一键彻底删除所有用户数据（保留配置文件）"""
        if not confirm:
            return {"ok": False, "message": "需要 confirm=True 确认执行擦除操作"}

        import shutil
        from sqlalchemy import delete as sqla_delete
        from ...db.vector_store import get_vector_store

        try:
            await db.execute(sqla_delete(DbMsg))
            await db.execute(sqla_delete(DbConv))
            await db.execute(sqla_delete(DbChunk))
            await db.execute(sqla_delete(DbDoc))
            await db.execute(sqla_delete(DbLTM))
            await db.execute(sqla_delete(DbProfile))
            await db.commit()
        except Exception as e:
            log.exception(f"擦除 DB 失败: {e}")

        try:
            vs = get_vector_store()
            # 清空集合
            cnt = vs.count_chunks()
            # 简单策略：删除 & 重建
            import chromadb
            vs_path = Path(settings.vector_store.chroma_persist_dir)
            if vs_path.exists():
                shutil.rmtree(vs_path, ignore_errors=True)
            # 重置单例
            get_vector_store.cache_clear()  # type: ignore[attr-defined]
        except Exception as e:
            log.warning(f"擦除向量库失败: {e}")

        for sub in ("documents", "cache", "graph_store"):
            p = Path(settings.paths.data_dir) / sub
            if p.exists():
                shutil.rmtree(p, ignore_errors=True)
                p.mkdir(parents=True, exist_ok=True)

        log.warning("已执行用户数据全量擦除 (wipe_all)")
        return {"ok": True, "message": "所有用户数据已擦除（配置文件保留）"}
