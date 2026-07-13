from __future__ import annotations

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, Float, BLOB, Index

from ..session import Base


class LongTermMemory(Base):
    __tablename__ = "long_term_memories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    content = Column(Text, nullable=False, comment="记忆内容（加密存储可选）")
    source_type = Column(String(32), nullable=False, default="auto_summary",
                         comment="user_explicit/auto_summary/experience")
    importance_score = Column(Float, nullable=False, default=0.5)
    access_count = Column(Integer, nullable=False, default=0)
    last_accessed_at = Column(DateTime, nullable=True)
    status = Column(String(16), nullable=False, default="active", comment="active/archived/expired")
    tags_json = Column(Text, nullable=False, default="[]")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    embedding_blob = Column(BLOB, nullable=True, comment="Embedding 向量二进制（可选冗余）")

    __table_args__ = (
        Index("ix_ltm_status_importance", "status", "importance_score"),
    )
