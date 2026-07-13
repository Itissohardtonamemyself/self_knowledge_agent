from __future__ import annotations

from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field


class Citation(BaseModel):
    index: int
    doc_id: str
    doc_title: str
    page_num: int
    source_path: Optional[str] = None
    snippet: str = ""
    score: float = 0.0


class ConversationCreate(BaseModel):
    title: str = "新对话"


class ConversationOut(BaseModel):
    id: str
    title: str
    msg_count: int
    created_at: datetime
    last_msg_at: datetime

    class Config:
        from_attributes = True


class MessageOut(BaseModel):
    id: str
    conv_id: str
    role: Literal["user", "assistant", "system"]
    content: str
    refs: list[Citation] = Field(default_factory=list)
    tokens_used: int = 0
    latency_ms: Optional[int] = None
    created_at: datetime
    seq_no: int


class ChatRequest(BaseModel):
    query: str
    mode: Literal["rag", "pure_llm", "search_only"] = "rag"
    stream: bool = True
    conv_id: Optional[str] = None
    top_k: Optional[int] = None
    temperature: Optional[float] = None


class ChatResponse(BaseModel):
    conv_id: str
    msg_id: str
    answer: str
    citations: list[Citation] = Field(default_factory=list)
    follow_ups: list[str] = Field(default_factory=list)
    tokens_used: int = 0
    latency_ms: int = 0
    mode: str = "rag"


class SimpleSearchRequest(BaseModel):
    q: str
    top_k: int = 6
    file_type: Optional[str] = None


class SearchHit(BaseModel):
    chunk_id: str
    doc_id: str
    doc_title: str
    content: str
    page_num: int
    score: float
    file_type: str
