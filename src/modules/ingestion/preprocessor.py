from __future__ import annotations

from typing import List
from dataclasses import dataclass

from ...schemas.document import RawDocument, ChunkInfo
from ...utils.text_utils import clean_text, estimate_tokens
from ...core.config import settings

try:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    _HAS_SPLITTER = True
except Exception:
    _HAS_SPLITTER = False


@dataclass
class ChunkedDocument:
    raw: RawDocument
    chunks: List[ChunkInfo]


class DocumentPreprocessor:
    """文本预处理 + 语义分块"""

    def __init__(self) -> None:
        self.chunk_size = settings.ingestion.chunk_size
        self.overlap = settings.ingestion.chunk_overlap
        if _HAS_SPLITTER:
            self._splitter = RecursiveCharacterTextSplitter(
                chunk_size=self.chunk_size,
                chunk_overlap=self.overlap,
                length_function=len,
                separators=[
                    "\n\n", "\n", "。", "！", "？", ";", ".", " ", "",
                ],
            )
        else:
            self._splitter = None

    def _fallback_split(self, text: str) -> list[str]:
        """无 langchain 时的简易分块"""
        if not text:
            return []
        chunks: list[str] = []
        sentences = []
        buf = ""
        for ch in text:
            buf += ch
            if ch in "\n。！？.!?;；":
                sentences.append(buf)
                buf = ""
        if buf.strip():
            sentences.append(buf)

        cur = ""
        for s in sentences:
            if len(cur) + len(s) <= self.chunk_size:
                cur += s
            else:
                if cur:
                    chunks.append(cur)
                # overlap
                tail = cur[-self.overlap:] if len(cur) > self.overlap else cur
                cur = tail + s
        if cur:
            chunks.append(cur)
        return chunks or [text]

    def split(self, text: str) -> list[str]:
        cleaned = clean_text(text)
        if not cleaned:
            return []
        if self._splitter is not None:
            return [c for c in self._splitter.split_text(cleaned) if c.strip()]
        return [c for c in self._fallback_split(cleaned) if c.strip()]

    def process(self, raw: RawDocument) -> ChunkedDocument:
        split_texts = self.split(raw.text)
        chunks: list[ChunkInfo] = []
        for idx, piece in enumerate(split_texts):
            chunk_id = f"{raw.doc_id}:0:{idx}"
            page = 0
            # 粗略归页
            if raw.pages:
                cum = 0
                for pi, page_text in enumerate(raw.pages):
                    cum += len(page_text)
                    if sum(len(s) for s in split_texts[:idx + 1]) <= cum:
                        page = pi
                        break
            chunks.append(ChunkInfo(
                id=chunk_id,
                doc_id=raw.doc_id,
                content=piece,
                page_num=page,
                position_idx=idx,
                token_count=estimate_tokens(piece),
            ))
        return ChunkedDocument(raw=raw, chunks=chunks)
