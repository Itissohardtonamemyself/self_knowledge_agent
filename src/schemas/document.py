from __future__ import annotations

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class RawDocument(BaseModel):
    """从原始文件解析出的纯文本结构"""
    doc_id: str
    source_path: str
    source_url: Optional[str] = None
    title: str = ""
    file_type: str
    file_size: int = 0
    text: str
    pages: list[str] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)


class DocumentBase(BaseModel):
    title: str = ""
    file_type: str = "unknown"
    tags: list[str] = Field(default_factory=list)
    summary: str = ""
    source_url: Optional[str] = None


class DocumentCreate(DocumentBase):
    source_path: str
    file_size: int = 0
    doc_id: Optional[str] = None
    chunk_count: int = 0


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    tags: Optional[list[str]] = None
    summary: Optional[str] = None


class ChunkInfo(BaseModel):
    id: str
    doc_id: str
    content: str
    page_num: int = 0
    position_idx: int = 0
    token_count: int = 0


class DocumentOut(DocumentBase):
    id: str
    source_path: str
    file_size: int = 0
    chunk_count: int = 0
    status: str
    error_msg: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DocumentUploadResponse(BaseModel):
    doc_id: str
    status: str
    title: str
    file_type: str
    file_size: int
    chunk_count: int
    message: str = "文档上传成功，已开始处理"


class DocumentImportUrlRequest(BaseModel):
    url: str
    title: Optional[str] = None
    tags: list[str] = Field(default_factory=list)


class DocumentSearchQuery(BaseModel):
    keyword: str = ""
    file_type: Optional[str] = None
    status: Optional[str] = None
    page: int = 1
    page_size: int = 20
