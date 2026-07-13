from __future__ import annotations

from pathlib import Path

from .base import BaseDocumentLoader


class PDFLoader(BaseDocumentLoader):
    supported_extensions = ["pdf"]
    file_type_label = "pdf"

    def _extract_text(self, path: Path) -> tuple[str, list[str]]:
        try:
            import fitz  # PyMuPDF
        except ImportError as e:  # pragma: no cover
            from ....core.exceptions import DocumentParseError
            raise DocumentParseError("请先安装 PyMuPDF (pip install PyMuPDF)") from e

        pages: list[str] = []
        full = []
        with fitz.open(path) as pdf:
            for page in pdf:
                text = page.get_text("text") or ""
                pages.append(text)
                full.append(text)
        return "\n".join(full), pages
