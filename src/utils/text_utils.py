from __future__ import annotations

import re
import html
import unicodedata
from typing import Optional

_WHITESPACE_RE = re.compile(r"\s+")
_HTML_TAG_RE = re.compile(r"<[^>]+>")
_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")


def estimate_tokens(text: str) -> int:
    """粗略估算 token 数：中文 1 字≈1.2 token，英文 1 词≈1.3 token"""
    if not text:
        return 0
    chinese_chars = sum(1 for c in text if "\u4e00" <= c <= "\u9fff")
    other = _WHITESPACE_RE.split(text.strip())
    english_words = sum(1 for w in other if any(ord(c) < 128 for c in w))
    return max(1, int(chinese_chars * 1.2 + english_words * 1.3))


def clean_text(text: Optional[str]) -> str:
    if not text:
        return ""
    text = html.unescape(text)
    text = _HTML_TAG_RE.sub(" ", text)
    text = unicodedata.normalize("NFKC", text)
    # 去除控制字符
    text = "".join(c for c in text if c == "\n" or c == "\t" or c == "\r" or not unicodedata.category(c).startswith("C"))
    # 空白压缩
    lines = []
    for line in text.splitlines():
        stripped = _WHITESPACE_RE.sub(" ", line).strip()
        if stripped:
            lines.append(stripped)
    return "\n".join(lines)


def normalize_fullwidth(text: str) -> str:
    """全半角转换"""
    result = []
    for c in text:
        code = ord(c)
        if code == 0x3000:
            result.append(" ")
        elif 0xFF01 <= code <= 0xFF5E:
            result.append(chr(code - 0xFEE0))
        else:
            result.append(c)
    return "".join(result)


def mask_emails(text: str) -> str:
    return _EMAIL_RE.sub("[EMAIL]", text)


def extract_snippet(content: str, around_pos: int = 0, length: int = 200) -> str:
    if not content:
        return ""
    content_len = len(content)
    start = max(0, around_pos - length // 2)
    end = min(content_len, start + length)
    if end - start < length:
        start = max(0, end - length)
    snippet = content[start:end].strip()
    prefix = "…" if start > 0 else ""
    suffix = "…" if end < content_len else ""
    return f"{prefix}{snippet}{suffix}"
