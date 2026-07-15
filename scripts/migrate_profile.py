#!/usr/bin/env python3
"""迁移脚本：为 user_profile 表添加新字段"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


async def main():
    from src.db.session import get_engine
    from sqlalchemy import text
    
    engine = get_engine()
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE user_profile ADD COLUMN name TEXT NOT NULL DEFAULT ''"))
            print("✅ 添加 name 字段")
        except Exception as e:
            print(f"⚠️  name 字段可能已存在: {e}")
        
        try:
            await conn.execute(text("ALTER TABLE user_profile ADD COLUMN learning_style TEXT NOT NULL DEFAULT ''"))
            print("✅ 添加 learning_style 字段")
        except Exception as e:
            print(f"⚠️  learning_style 字段可能已存在: {e}")
        
        try:
            await conn.execute(text("ALTER TABLE user_profile ADD COLUMN background TEXT NOT NULL DEFAULT ''"))
            print("✅ 添加 background 字段")
        except Exception as e:
            print(f"⚠️  background 字段可能已存在: {e}")
        
        try:
            await conn.execute(text("ALTER TABLE user_profile ADD COLUMN interests_json TEXT NOT NULL DEFAULT '[]'"))
            print("✅ 添加 interests_json 字段")
        except Exception as e:
            print(f"⚠️  interests_json 字段可能已存在: {e}")
    
    print("\n🎉 迁移完成！")


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
