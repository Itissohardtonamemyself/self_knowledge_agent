from __future__ import annotations

from pathlib import Path
import re

from .base import BaseDocumentLoader


class MarkdownLoader(BaseDocumentLoader):
    supported_extensions = ["md", "markdown"]
    file_type_label = "markdown"

    _MD_CODE_BLOCK = re.compile(r"```[\s\S]*?```")
    _MD_IMG = re.compile(r"!\[[^\]]*\]\([^)]+\)")
    _MD_LINK = re.compile(r"\[([^\]]+)\]\([^)]+\)")

    def _extract_text(self, path: Path) -> tuple[str, list[str]]:
        text = path.read_text(encoding="utf-8", errors="ignore")
        cleaned = self._MD_CODE_BLOCK.sub("[代码块]", text)
        cleaned = self._MD_IMG.sub("[图片]", cleaned)
        cleaned = self._MD_LINK.sub(r"\1", cleaned)
        # 简化标题标记
        cleaned = re.sub(r"^#{1,6}\s*", "", cleaned, flags=re.MULTILINE)
        # 按一级标题分页
        pages = re.split(r"\n(?=#{1,2}\s+)", cleaned)
        pages = [p.strip() for p in pages if p.strip()]
        return cleaned.strip(), pages or [cleaned.strip()]
