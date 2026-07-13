from __future__ import annotations

from pathlib import Path

from .base import BaseDocumentLoader


class TextLoader(BaseDocumentLoader):
    supported_extensions = ["txt", "log", "csv", "json", "yaml", "yml", "py", "js", "ts", "html", "htm"]
    file_type_label = "text"

    def _extract_text(self, path: Path) -> tuple[str, list[str]]:
        # 尝试多种编码
        for encoding in ("utf-8", "utf-8-sig", "gbk", "latin-1"):
            try:
                text = path.read_text(encoding=encoding)
                break
            except (UnicodeDecodeError, LookupError):
                continue
        else:
            text = path.read_text(encoding="utf-8", errors="ignore")
        # 按 80 行粗略分页
        lines = text.splitlines()
        pages = ["\n".join(lines[i:i + 80]) for i in range(0, max(1, len(lines)), 80)]
        return text, pages
