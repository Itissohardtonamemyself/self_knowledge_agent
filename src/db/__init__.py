from __future__ import annotations

from .session import Base, get_engine, get_session_factory, get_db_session, create_all_tables, run_sync_with_db
from .cache import CacheStore, get_cache
from . import models

try:
    from .vector_store import VectorStore, get_vector_store
except Exception:
    VectorStore = None

    def get_vector_store(*args, **kwargs):
        raise RuntimeError("请安装 chromadb 依赖后再使用向量数据库 (pip install -r requirements.txt)")

try:
    from .graph_store import GraphStore, get_graph_store
except Exception:
    GraphStore = None

    def get_graph_store(*args, **kwargs):
        raise RuntimeError("请安装 networkx 依赖后再使用图存储 (pip install -r requirements.txt)")

__all__ = [
    "Base", "get_engine", "get_session_factory", "get_db_session", "create_all_tables", "run_sync_with_db",
    "VectorStore", "get_vector_store",
    "GraphStore", "get_graph_store",
    "CacheStore", "get_cache",
    "models",
]
