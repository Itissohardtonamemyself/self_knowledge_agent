from __future__ import annotations

from pathlib import Path
from typing import List, Type

from ....core.exceptions import UnsupportedFileTypeError
from .base import BaseDocumentLoader
from .pdf_loader import PDFLoader
from .docx_loader import DocxLoader
from .markdown_loader import MarkdownLoader
from .text_loader import TextLoader
from .web_loader import WebLoader


_REGISTERED_LOADERS: List[Type[BaseDocumentLoader]] = [
    PDFLoader, DocxLoader, MarkdownLoader, TextLoader, WebLoader,
]


def get_loader_for_filename(filename: str) -> BaseDocumentLoader:
    for cls in _REGISTERED_LOADERS:
        if cls.supports(filename):
            return cls()
    raise UnsupportedFileTypeError(f"暂不支持的文件类型: {filename}")


def list_supported_extensions() -> List[str]:
    ext = set()
    for cls in _REGISTERED_LOADERS:
        ext.update(cls.supported_extensions)
    return sorted(ext)


__all__ = [
    "BaseDocumentLoader", "PDFLoader", "DocxLoader", "MarkdownLoader", "TextLoader", "WebLoader",
    "get_loader_for_filename", "list_supported_extensions",
]
