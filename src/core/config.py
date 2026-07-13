from __future__ import annotations

from typing import Any, Dict, List, Optional
from pathlib import Path

import yaml
from pydantic import BaseModel, Field, ConfigDict
from pydantic_settings import BaseSettings


class PathsConfig(BaseModel):
    data_dir: str = "./data"
    documents_dir: str = "./data/documents"
    sqlite_dir: str = "./data/sqlite"
    vector_store_dir: str = "./data/vector_store"
    graph_store_dir: str = "./data/graph_store"
    cache_dir: str = "./data/cache"
    logs_dir: str = "./logs"
    prompts_dir: str = "./config/prompts"

    def ensure_all(self) -> None:
        for v in (
            self.data_dir, self.documents_dir, self.sqlite_dir,
            self.vector_store_dir, self.graph_store_dir, self.cache_dir, self.logs_dir,
        ):
            Path(v).mkdir(parents=True, exist_ok=True)


class ServerConfig(BaseModel):
    host: str = "127.0.0.1"
    port: int = 8000
    cors_origins: List[str] = Field(default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"])


class DatabaseConfig(BaseModel):
    sqlite_url: str = "sqlite+aiosqlite:///./data/sqlite/agent.db"
    sqlite_sync_url: str = "sqlite:///./data/sqlite/agent.db"
    echo_sql: bool = False


class VectorStoreConfig(BaseModel):
    provider: str = "chroma"
    chroma_persist_dir: str = "./data/vector_store"
    default_collection: str = "chunks_v1"
    memory_collection: str = "memories_v1"


class EmbedderConfig(BaseModel):
    provider: str = "bge_local"
    bge_model_name: str = "BAAI/bge-small-zh-v1.5"
    bge_device: str = "cpu"
    batch_size: int = 32
    openai_api_key: Optional[str] = None
    openai_model: str = "text-embedding-3-small"


class LLMConfig(BaseModel):
    provider: str = "mock"
    temperature: float = 0.2
    max_tokens: int = 2048
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-4o-mini"
    anthropic_api_key: Optional[str] = None
    anthropic_model: str = "claude-3-5-sonnet-20240620"
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "qwen2.5:7b"
    glm_api_key: Optional[str] = None
    glm_model: str = "glm-4.7-flash"
    glm_base_url: str = "https://open.bigmodel.cn/api/paas/v4/"


class RetrievalConfig(BaseModel):
    vector_top_k: int = 20
    rerank_top_k: int = 6
    hybrid_alpha: float = 0.6
    score_threshold: float = 0.3


class MemoryConfig(BaseModel):
    short_term_window: int = 20
    long_term_top_k: int = 3


class IngestionConfig(BaseModel):
    chunk_size: int = 512
    chunk_overlap: int = 64
    max_threads: int = 4


class PrivacyConfig(BaseModel):
    encrypt_sensitive: bool = False
    master_password: str = ""
    mask_sensitive_fields: bool = True


class LoggingConfig(BaseModel):
    level: str = "INFO"
    file: str = "./logs/app.log"
    rotation: str = "10 MB"
    retention: str = "7 days"


class AppConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")

    project: Dict[str, Any] = Field(default_factory=dict)
    server: ServerConfig = Field(default_factory=ServerConfig)
    paths: PathsConfig = Field(default_factory=PathsConfig)
    database: DatabaseConfig = Field(default_factory=DatabaseConfig)
    vector_store: VectorStoreConfig = Field(default_factory=VectorStoreConfig)
    embedder: EmbedderConfig = Field(default_factory=EmbedderConfig)
    llm: LLMConfig = Field(default_factory=LLMConfig)
    retrieval: RetrievalConfig = Field(default_factory=RetrievalConfig)
    memory: MemoryConfig = Field(default_factory=MemoryConfig)
    ingestion: IngestionConfig = Field(default_factory=IngestionConfig)
    privacy: PrivacyConfig = Field(default_factory=PrivacyConfig)
    logging: LoggingConfig = Field(default_factory=LoggingConfig)


def load_config(config_path: str = "config/config.yaml") -> AppConfig:
    path = Path(config_path)
    if not path.exists():
        path = Path(__file__).resolve().parent.parent.parent / "config" / "config.yaml"
    if not path.exists():
        return AppConfig()
    with open(path, "r", encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}
    return AppConfig(**raw)


# 全局单例
settings: AppConfig = load_config()
