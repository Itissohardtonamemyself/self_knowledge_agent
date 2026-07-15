from __future__ import annotations

from typing import Any, Optional, Dict
from fastapi import HTTPException, status


class AppBaseException(Exception):
    code: str = "APP_ERROR"
    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    message: str = "服务内部错误"
    data: Optional[Dict[str, Any]] = None

    def __init__(
        self,
        message: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None,
        code: Optional[str] = None,
    ) -> None:
        if message:
            self.message = message
        if code:
            self.code = code
        self.data = data
        super().__init__(self.message)


# === 配置类 ===
class ConfigError(AppBaseException):
    code = "CONFIG_ERROR"
    status_code = 500
    message = "配置错误"


# === 文档摄入 ===
class DocumentParseError(AppBaseException):
    code = "DOC_PARSE_ERROR"
    status_code = 400
    message = "文档解析失败"


class UnsupportedFileTypeError(AppBaseException):
    code = "UNSUPPORTED_FILE_TYPE"
    status_code = 400
    message = "不支持的文件类型"


class DocumentNotFoundError(AppBaseException):
    code = "DOC_NOT_FOUND"
    status_code = 404
    message = "文档不存在"


class DocumentProcessingError(AppBaseException):
    code = "DOC_PROCESSING_ERROR"
    status_code = 500
    message = "文档处理失败"


# === AI / LLM ===
class LLMProviderError(AppBaseException):
    code = "LLM_PROVIDER_ERROR"
    status_code = 502
    message = "大模型服务异常"


class EmbeddingError(AppBaseException):
    code = "EMBEDDING_ERROR"
    status_code = 500
    message = "向量化处理失败"


# === 存储 ===
class VectorStoreError(AppBaseException):
    code = "VECTOR_STORE_ERROR"
    status_code = 500
    message = "向量数据库异常"


class DatabaseError(AppBaseException):
    code = "DB_ERROR"
    status_code = 500
    message = "数据库操作失败"


class PrivacyError(AppBaseException):
    code = "PRIVACY_ERROR"
    status_code = 403
    message = "隐私保护校验失败"


def to_http_exception(exc: AppBaseException) -> HTTPException:
    return HTTPException(
        status_code=exc.status_code,
        detail={
            "code": exc.code,
            "message": exc.message,
            "data": exc.data or {},
        },
    )
