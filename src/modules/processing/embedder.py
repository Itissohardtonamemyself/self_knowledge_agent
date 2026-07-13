from __future__ import annotations

from abc import ABC, abstractmethod
from typing import List
from functools import lru_cache

from ...core.config import settings
from ...core.logging import log
from ...core.exceptions import EmbeddingError


class BaseEmbedder(ABC):
    @abstractmethod
    def embed_documents(self, texts: List[str]) -> List[List[float]]: ...

    @abstractmethod
    def embed_query(self, text: str) -> List[float]: ...

    @property
    @abstractmethod
    def dimension(self) -> int: ...


class MockEmbedder(BaseEmbedder):
    """用于离线/测试的 Mock Embedder：基于字符哈希生成伪随机但稳定的 384-dim 向量"""
    _DIM = 384

    @property
    def dimension(self) -> int:
        return self._DIM

    @staticmethod
    def _stable_hash(text: str) -> float:
        import hashlib
        h = hashlib.md5(text.encode("utf-8")).digest()
        return (int.from_bytes(h[:4], "big") % 100000) / 100000.0

    def _vec(self, text: str) -> List[float]:
        import math
        vec = [0.0] * self._DIM
        # 基于滑动窗口哈希
        seed_text = text or " "
        for i in range(self._DIM):
            vec[i] = (self._stable_hash(f"{i}|{seed_text}") - 0.5) * 2
        # 归一化
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        return [v / norm for v in vec]

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return [self._vec(t) for t in texts]

    def embed_query(self, text: str) -> List[float]:
        return self._vec(text)


class BGELocalEmbedder(BaseEmbedder):
    _MODEL = None
    _MODEL_NAME: str = ""

    def __init__(self, model_name: str | None = None, device: str | None = None) -> None:
        self._cfg_name = model_name or settings.embedder.bge_model_name
        self._device = device or settings.embedder.bge_device
        self._dimension_cache: int | None = None
        self._lazy_load()

    def _lazy_load(self) -> None:
        if BGELocalEmbedder._MODEL is not None and BGELocalEmbedder._MODEL_NAME == self._cfg_name:
            return
        try:
            from sentence_transformers import SentenceTransformer
            log.info(f"加载 Embedding 模型: {self._cfg_name} (device={self._device})")
            BGELocalEmbedder._MODEL = SentenceTransformer(self._cfg_name, device=self._device)
            BGELocalEmbedder._MODEL_NAME = self._cfg_name
        except Exception as e:  # pragma: no cover
            raise EmbeddingError(f"加载 BGE Embedding 失败，请安装 sentence-transformers: {e}") from e

    @property
    def dimension(self) -> int:
        if self._dimension_cache is None:
            vec = self._MODEL.encode(["ping"])
            self._dimension_cache = int(vec.shape[1])
        return self._dimension_cache

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        try:
            arr = self._MODEL.encode(
                texts, batch_size=settings.embedder.batch_size,
                normalize_embeddings=True, show_progress_bar=False,
            )
            return arr.tolist()
        except Exception as e:
            raise EmbeddingError(f"encode documents 失败: {e}") from e

    def embed_query(self, text: str) -> List[float]:
        try:
            vec = self._MODEL.encode([text], normalize_embeddings=True)
            return vec[0].tolist()
        except Exception as e:
            raise EmbeddingError(f"encode query 失败: {e}") from e


class OpenAIEmbedder(BaseEmbedder):
    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        self._api_key = api_key or settings.embedder.openai_api_key
        self._model = model or settings.embedder.openai_model
        if not self._api_key:
            raise EmbeddingError("OpenAI API Key 未配置")
        self._dim: int | None = None

    @property
    def dimension(self) -> int:
        if self._dim is None:
            self._dim = len(self.embed_query("ping"))
        return self._dim

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        try:
            from openai import OpenAI
            client = OpenAI(api_key=self._api_key)
            results = []
            # 分批: OpenAI 单次最多 2048
            for i in range(0, len(texts), 500):
                batch = texts[i:i + 500]
                resp = client.embeddings.create(input=batch, model=self._model)
                results.extend([e.embedding for e in resp.data])
            return results
        except ImportError as e:
            raise EmbeddingError(f"请安装 openai: {e}") from e
        except Exception as e:
            raise EmbeddingError(f"OpenAI embeddings 失败: {e}") from e

    def embed_query(self, text: str) -> List[float]:
        return self.embed_documents([text])[0]


@lru_cache(maxsize=1)
def get_embedder() -> BaseEmbedder:
    provider = settings.embedder.provider.lower()
    log.info(f"初始化 Embedder Provider: {provider}")
    try:
        if provider == "bge_local":
            return BGELocalEmbedder()
        if provider == "openai":
            return OpenAIEmbedder()
    except Exception as e:
        log.warning(f"Embedder {provider} 初始化失败，降级为 MockEmbedder: {e}")
    return MockEmbedder()
