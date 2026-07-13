from __future__ import annotations

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Index
from sqlalchemy.orm import relationship

from ..session import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String(32), primary_key=True)
    title = Column(String(512), nullable=False, default="新对话")
    msg_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    last_msg_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan",
                            order_by="Message.created_at", lazy="selectin")


class Message(Base):
    __tablename__ = "messages"

    id = Column(String(32), primary_key=True)
    conv_id = Column(String(32), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(16), nullable=False, comment="user/assistant/system")
    content = Column(Text, nullable=False)
    refs_json = Column(Text, nullable=True, comment="引用来源 JSON")
    tokens_used = Column(Integer, nullable=False, default=0)
    latency_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    seq_no = Column(Integer, nullable=False, default=0)

    conversation = relationship("Conversation", back_populates="messages")

    __table_args__ = (
        Index("ix_messages_conv_seq", "conv_id", "seq_no"),
    )
