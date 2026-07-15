from __future__ import annotations

from pathlib import Path
from urllib.parse import urlparse

from .base import BaseDocumentLoader
from ....utils.file_utils import get_file_hash
from ....schemas.document import RawDocument


class WebLoader(BaseDocumentLoader):
    supported_extensions = ["html", "htm"]
    file_type_label = "web"

    @staticmethod
    def _try_trafilatura(html: str) -> str | None:
        try:
            import trafilatura
            return trafilatura.extract(html, include_links=False, include_images=False) or None
        except Exception:
            return None

    @staticmethod
    def _try_bs4(html: str, url: str | None = None) -> str:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "lxml")
        for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
            tag.extract()
        return soup.get_text("\n", strip=True)

    def _extract_text(self, path: Path) -> tuple[str, list[str]]:
        html = path.read_text(encoding="utf-8", errors="ignore")
        text = self._try_trafilatura(html) or self._try_bs4(html)
        pages = [text[i:i + 4000] for i in range(0, max(1, len(text)), 4000)]
        return text, pages

    def load_from_url(self, url: str, doc_id: str | None = None, title: str | None = None) -> RawDocument:
        import httpx
        from ....core.exceptions import DocumentParseError
        try:
            with httpx.Client(follow_redirects=True, timeout=30) as client:
                resp = client.get(url, headers={
                    "User-Agent": "Mozilla/5.0 (SelfKnowledgeAgent/0.1)",
                })
                resp.raise_for_status()
                html = resp.text
        except Exception as e:
            raise DocumentParseError(f"抓取网页失败 {url}: {e}") from e

        text = self._try_trafilatura(html) or self._try_bs4(html, url)
        did = doc_id or get_file_hash(url, use_content=False)
        parsed = urlparse(url)
        final_title = title or parsed.netloc + parsed.path
        return RawDocument(
            doc_id=did,
            source_path="",
            source_url=url,
            title=final_title,
            file_type="web",
            file_size=len(html.encode("utf-8", "ignore")),
            text=text,
            pages=[text[i:i + 4000] for i in range(0, max(1, len(text)), 4000)],
            metadata={"url": url, "domain": parsed.netloc},
        )
