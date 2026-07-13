from __future__ import annotations

import sys
from pathlib import Path

# 让项目根目录可直接用 src.* 导入
ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from src.core.config import settings
from src.core.logging import log
from src.core.exceptions import AppBaseException, to_http_exception
from src.db.session import create_all_tables, get_engine
from src.modules.ingestion.router import router as ingestion_router
from src.modules.processing.router import router as processing_router
from src.modules.memory.router import router as memory_router
from src.modules.interaction.router import router as interaction_router
from src.modules.maintenance.router import router as maintenance_router
from src.modules.privacy.router import router as privacy_router
from src.schemas.common import ApiResponse, HealthResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动
    settings.paths.ensure_all()
    try:
        await create_all_tables()
    except Exception as e:
        log.exception(f"数据库初始化失败: {e}")
    log.info(f"✅ Self Knowledge Agent 启动完成: http://{settings.server.host}:{settings.server.port}")
    yield
    # 关闭
    try:
        engine = get_engine()
        await engine.dispose()
    except Exception:
        pass
    log.info("🛑 服务已关闭")


app = FastAPI(
    title="Self Knowledge Agent API",
    description="个人数据知识库 Agent 后端 API — 数字知识伙伴",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.server.cors_origins + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AppBaseException)
async def app_base_exception_handler(request: Request, exc: AppBaseException):
    http_exc = to_http_exception(exc)
    return JSONResponse(
        status_code=http_exc.status_code,
        content={"code": http_exc.detail.get("code"), "message": http_exc.detail.get("message"),
                 "data": http_exc.detail.get("data") or {}},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    log.opt(exception=True).error(f"未处理异常: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"code": "INTERNAL_ERROR", "message": f"{type(exc).__name__}: {exc}", "data": {}},
    )


@app.get("/api/v1/health", response_model=ApiResponse[HealthResponse], tags=["系统 System"])
async def health_check():
    from src.db.session import get_session_factory
    from sqlalchemy import select, text
    from src.modules.interaction.service import InteractionService
    stats = {}
    try:
        factory = get_session_factory()
        async with factory() as db:
            stats = await InteractionService().health_stats(db)
    except Exception as e:
        stats = {"error": str(e)}
    data = HealthResponse(status="ok", version="0.1.0", stats=stats)
    return ApiResponse.success(data)


@app.get("/", tags=["系统 System"])
async def root():
    return {
        "name": "Self Knowledge Agent API",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/api/v1/health",
    }


# ========== 路由注册 ==========
API_PREFIX = "/api/v1"
app.include_router(ingestion_router, prefix=API_PREFIX)
app.include_router(processing_router, prefix=API_PREFIX)
app.include_router(memory_router, prefix=API_PREFIX)
app.include_router(interaction_router, prefix=API_PREFIX)
app.include_router(maintenance_router, prefix=API_PREFIX)
app.include_router(privacy_router, prefix=API_PREFIX)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.server.host,
        port=settings.server.port,
        reload=False,
        log_level="info",
    )
