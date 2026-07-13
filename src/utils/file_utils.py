from __future__ import annotations

import os
import hashlib
from pathlib import Path
from typing import Optional


def get_file_hash(file_path: str, use_content: bool = True, length: int = 16) -> str:
    """计算文件 ID：mtime+size（快）或 内容哈希（准）"""
    path = Path(file_path)
    if use_content and path.exists():
        try:
            h = hashlib.sha256()
            with open(path, "rb") as f:
                while chunk := f.read(1 << 20):
                    h.update(chunk)
            return h.hexdigest()[:length]
        except Exception:
            pass
    stat = path.stat()
    raw = f"{str(path).lower()}|{stat.st_size}|{int(stat.st_mtime_ns / 1000)}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:length]


def ensure_dir(path: str) -> Path:
    p = Path(path)
    p.mkdir(parents=True, exist_ok=True)
    return p


def human_file_size(size: int) -> str:
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} PB"


def safe_filename(name: str) -> str:
    name = "".join(c if c.isalnum() or c in "_-. " else "_" for c in name).strip()
    return name or "unnamed"


def get_extension(path: str) -> str:
    return Path(path).suffix.lower().lstrip(".")


def unique_path(directory: str, filename: str) -> str:
    """若文件存在则追加序号"""
    ensure_dir(directory)
    p = Path(directory) / filename
    if not p.exists():
        return str(p)
    stem, suffix = p.stem, p.suffix
    i = 1
    while True:
        cand = Path(directory) / f"{stem}_{i}{suffix}"
        if not cand.exists():
            return str(cand)
        i += 1
