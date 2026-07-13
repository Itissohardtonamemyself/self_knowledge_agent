from __future__ import annotations

from pathlib import Path
from functools import lru_cache
from typing import Any, Optional

from ..core.config import settings
from ..core.logging import log

try:
    import diskcache  # type: ignore
    _HAS_DISKCACHE = True
except Exception:
    _HAS_DISKCACHE = False


class CacheStore:
    """diskcache 封装，退化为内存 dict"""

    def __init__(self) -> None:
        self._fallback: dict = {}
        self._cache = None
        if _HAS_DISKCACHE:
            try:
                path = settings.paths.cache_dir
                Path(path).mkdir(parents=True, exist_ok=True)
                self._cache = diskcache.Cache(path)
                log.info("diskcache 初始化完成")
                return
            except Exception as e:
                log.warning(f"diskcache 初始化失败，降级为内存缓存: {e}")
        self._cache = None

    def get(self, key: str, default: Any = None) -> Any:
        try:
            if self._cache is not None:
                return self._cache.get(key, default=default)
            return self._fallback.get(key, default)
        except Exception:
            return default

    def set(self, key: str, value: Any, expire: Optional[int] = None) -> None:
        try:
            if self._cache is not None:
                self._cache.set(key, value, expire=expire)
            else:
                self._fallback[key] = value
        except Exception as e:
            log.debug(f"cache set 失败: {e}")

    def delete(self, key: str) -> None:
        try:
            if self._cache is not None:
                self._cache.delete(key)
            elif key in self._fallback:
                del self._fallback[key]
        except Exception:
            pass

    def clear(self) -> None:
        try:
            if self._cache is not None:
                self._cache.clear()
            self._fallback.clear()
        except Exception:
            pass


@lru_cache(maxsize=1)
def get_cache() -> CacheStore:
    return CacheStore()
