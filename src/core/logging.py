from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

from loguru import logger

from .config import settings


def setup_logging() -> Any:
    level = settings.logging.level.upper()
    log_file = Path(settings.logging.file)
    log_file.parent.mkdir(parents=True, exist_ok=True)

    logger.remove()

    logger.add(
        sys.stdout,
        level=level,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
               "<level>{level: <8}</level> | "
               "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
               "<level>{message}</level>",
        enqueue=True,
    )

    logger.add(
        str(log_file),
        level=level,
        rotation=settings.logging.rotation,
        retention=settings.logging.retention,
        compression="zip",
        enqueue=True,
        encoding="utf-8",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
    )
    return logger


setup_logging()
log = logger
