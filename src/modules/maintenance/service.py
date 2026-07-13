from __future__ import annotations

import shutil
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.config import settings
from ...core.logging import log
from ...db.models.document import Document as DbDoc, Chunk as DbChunk


class MaintenanceService:
    async def health_check(self, db: AsyncSession) -> dict:
        """知识库健康检查（MVP 版本：基础一致性 + 空文档 + 文档/Chunk 数量对齐）"""
        docs_total = (await db.execute(select(DbDoc))).scalars().all()
        issues: list[dict] = []

        # 1. 文档 vs Chunk 数量对齐
        chunk_mismatch = 0
        empty_docs = 0
        processing_docs = 0
        for d in docs_total:
            if d.status != "completed":
                processing_docs += 1
            actual_chunks = (await db.execute(
                select(DbChunk).where(DbChunk.doc_id == d.id)
            )).scalars().all()
            if len(actual_chunks) != d.chunk_count:
                chunk_mismatch += 1
                issues.append({
                    "level": "warning", "type": "chunk_count_mismatch",
                    "doc_id": d.id, "title": d.title,
                    "expected": d.chunk_count, "actual": len(actual_chunks),
                    "suggestion": "建议触发重建该文档索引",
                })
            if len(actual_chunks) == 0:
                empty_docs += 1
                issues.append({
                    "level": "warning", "type": "empty_document",
                    "doc_id": d.id, "title": d.title,
                    "suggestion": "文档没有任何 Chunk，可能解析失败或内容为空",
                })

        # 2. 向量库对齐（抽样）
        try:
            from ...db.vector_store import get_vector_store
            vs = get_vector_store()
            vs_count = vs.count_chunks()
        except Exception as e:
            vs_count = 0
            issues.append({"level": "error", "type": "vector_store_unavailable",
                           "message": f"向量库异常: {e}"})

        total_chunks = len(list((await db.execute(select(DbChunk))).scalars().all()))
        if vs_count != total_chunks and total_chunks > 0:
            issues.append({
                "level": "warning", "type": "vector_db_inconsistent",
                "db_chunks": total_chunks, "vector_chunks": vs_count,
                "suggestion": "建议执行全量重建索引",
            })

        return {
            "timestamp": datetime.utcnow().isoformat(),
            "summary": {
                "total_documents": len(docs_total),
                "total_chunks": total_chunks,
                "vector_chunks": vs_count,
                "processing_docs": processing_docs,
                "empty_docs": empty_docs,
                "chunk_mismatch": chunk_mismatch,
                "issues_count": len(issues),
            },
            "issues": issues,
        }

    async def create_backup(self, backup_dir: Optional[str] = None) -> dict:
        """创建完整备份：SQLite + 向量库 + documents（可选）打包为 zip"""
        base = Path(backup_dir or settings.paths.data_dir) / "backups"
        base.mkdir(parents=True, exist_ok=True)
        ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        zip_path = base / f"backup_{ts}.zip"

        data_root = Path(settings.paths.data_dir)
        def _safe_iter(p: Path):
            try:
                return list(p.rglob("*"))
            except Exception:
                return []

        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            # SQLite
            sqlite_dir = Path(settings.paths.sqlite_dir)
            for f in _safe_iter(sqlite_dir):
                if f.is_file():
                    zf.write(f, f"sqlite/{f.relative_to(sqlite_dir)}")
            # 向量库
            vs_dir = Path(settings.paths.vector_store_dir)
            for f in _safe_iter(vs_dir):
                if f.is_file():
                    zf.write(f, f"vector_store/{f.relative_to(vs_dir)}")
            # 图存储
            gs_dir = Path(settings.paths.graph_store_dir)
            for f in _safe_iter(gs_dir):
                if f.is_file():
                    zf.write(f, f"graph_store/{f.relative_to(gs_dir)}")
            # documents 目录（用户原始文件）
            docs_dir = Path(settings.paths.documents_dir)
            for f in _safe_iter(docs_dir):
                if f.is_file():
                    try:
                        zf.write(f, f"documents/{f.relative_to(docs_dir)}")
                    except Exception:
                        pass

        size = zip_path.stat().st_size
        log.info(f"备份创建完成: {zip_path} ({size/1024/1024:.2f}MB)")
        return {
            "backup_file": str(zip_path),
            "size_bytes": size,
            "timestamp": ts,
        }

    async def restore_backup(self, backup_path: str, overwrite: bool = False) -> dict:
        bp = Path(backup_path)
        if not bp.exists():
            return {"ok": False, "error": "备份文件不存在"}
        if overwrite:
            # 清空现有数据目录下的子目录
            for sub in ("sqlite", "vector_store", "graph_store", "documents"):
                p = Path(settings.paths.data_dir) / sub
                if p.exists():
                    shutil.rmtree(p, ignore_errors=True)
        target = Path(settings.paths.data_dir)
        target.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(bp, "r") as zf:
            zf.extractall(target)
        return {"ok": True, "extracted_to": str(target)}
