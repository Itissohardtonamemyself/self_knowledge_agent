from __future__ import annotations

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime

from ..session import Base


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(64), nullable=False, unique=True, index=True)
    color = Column(String(16), nullable=False, default="#409EFF")
    doc_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
