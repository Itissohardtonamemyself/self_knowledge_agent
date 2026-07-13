from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import List

from ....schemas.document import RawDocument
from ....utils.file_utils import get_file_hash, get_extension
from ....core.config import settings


class BaseDocumentLoader(ABC):
    """文档加载器抽象基类"""

    supported_extensions: List[str] = []
    file_type_label: str = "unknown"

    @abstractmethod
    def _extract_text(self, path: Path) -> tuple[str, list[str]]:
        """返回 (完整文本, 按页分的文本列表)"""
        ...

    def extract_title(self, path: Path, fallback_content: str) -> str:
        name = path.stem
        if name and len(name) > 2:
            return name
        first_line = (fallback_content.split("\n", 1)[0]).strip()[:120]
        return first_line or name or "Untitled"

    def load(self, source: str, doc_id: str | None = None, source_url: str | None = None) -> RawDocument:
        path = Path(source)
        if not path.exists():
            from ....core.exceptions import DocumentParseError
            raise DocumentParseError(f"文件不存在: {source}")

        file_size = path.stat().st_size
        try:
            text, pages = self._extract_text(path)
        except Exception as e:
            from ....core.exceptions import DocumentParseError
            raise DocumentParseError(f"解析 {path.name} 失败: {e}") from e

        did = doc_id or get_file_hash(str(path))
        title = self.extract_title(path, text)
        return RawDocument(
            doc_id=did,
            source_path=str(path.resolve()),
            source_url=source_url,
            title=title,
            file_type=self.file_type_label or get_extension(str(path)) or "unknown",
            file_size=file_size,
            text=text,
            pages=pages,
            metadata={
                "filename": path.name,
                "suffix": path.suffix.lower(),
            },
        )

    @classmethod
    def supports(cls, filename: str) -> bool:
        ext = get_extension(filename)
        return ext in cls.supported_extensions
