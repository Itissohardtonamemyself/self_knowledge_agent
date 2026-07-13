from __future__ import annotations

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Index
from sqlalchemy.orm import relationship

from ..session import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(32), primary_key=True, comment="sha256(source+size+mtime)[:16]")
    source_path = Column(String(1024), nullable=False, comment="原始文件路径")
    title = Column(String(512), nullable=False, default="", comment="文档标题")
    file_type = Column(String(32), nullable=False, default="unknown", comment="pdf/docx/md/txt/web")
    file_size = Column(Integer, nullable=False, default=0)
    chunk_count = Column(Integer, nullable=False, default=0)
    tags_json = Column(Text, nullable=False, default="[]", comment="标签 JSON 数组")
    summary = Column(Text, nullable=False, default="", comment="自动摘要")
    source_url = Column(String(1024), nullable=True, comment="网页 URL (可选)")
    status = Column(String(16), nullable=False, default="processing", comment="processing/completed/failed")
    error_msg = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    chunks = relationship("Chunk", back_populates="document", cascade="all, delete-orphan", lazy="selectin")

    __table_args__ = (
        Index("ix_documents_file_type", "file_type"),
    )


class Chunk(Base):
    __tablename__ = "chunks"

    id = Column(String(64), primary_key=True, comment="{doc_id}:{page}:{idx}")
    doc_id = Column(String(32), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=False, comment="Chunk 原文")
    page_num = Column(Integer, nullable=False, default=0)
    char_start = Column(Integer, nullable=False, default=0)
    char_end = Column(Integer, nullable=False, default=0)
    token_count = Column(Integer, nullable=False, default=0)
    position_idx = Column(Integer, nullable=False, default=0, comment="在文档中的顺序")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    document = relationship("Document", back_populates="chunks")

    __table_args__ = (
        Index("ix_chunks_doc_id_idx", "doc_id", "position_idx"),
    )
