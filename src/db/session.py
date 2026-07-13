from __future__ import annotations

from typing import AsyncIterator, Callable
from functools import lru_cache

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

from ..core.config import settings
from ..core.logging import log

Base = declarative_base()


@lru_cache(maxsize=1)
def get_engine():
    log.info(f"初始化数据库引擎: {settings.database.sqlite_url}")
    return create_async_engine(
        settings.database.sqlite_url,
        echo=settings.database.echo_sql,
        future=True,
        connect_args={"check_same_thread": False},
    )


@lru_cache(maxsize=1)
def get_session_factory() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(
        bind=get_engine(),
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )


async def get_db_session() -> AsyncIterator[AsyncSession]:
    """FastAPI 依赖: 数据库会话"""
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_all_tables() -> None:
    from . import models  # noqa: F401  加载模型
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    log.info("数据库表创建完成")


def run_sync_with_db(func: Callable) -> None:
    """同步工具脚本使用"""
    import asyncio
    from sqlalchemy import create_engine
    from ..core.config import settings
    engine = create_engine(settings.database.sqlite_sync_url, echo=settings.database.echo_sql, future=True)
    from . import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    engine.dispose()
