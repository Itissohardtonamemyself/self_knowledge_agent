from __future__ import annotations

import json
from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...db.models.user_profile import UserProfile as DbProfile
from ...db.models.memory import LongTermMemory as DbLTM
from ...schemas.memory import (
    UserProfileOut, UserProfileUpdate,
    LongTermMemoryCreate, LongTermMemoryOut,
)


class MemoryService:
    async def get_profile(self, db: AsyncSession) -> UserProfileOut:
        stmt = select(DbProfile).where(DbProfile.id == 1)
        p = (await db.execute(stmt)).scalar_one_or_none()
        if not p:
            p = DbProfile(id=1)
            db.add(p)
            await db.commit()
            await db.refresh(p)
        try:
            domains = json.loads(p.domains_json) if p.domains_json else []
        except Exception:
            domains = []
        try:
            preferences = json.loads(p.preferences_json) if p.preferences_json else {}
        except Exception:
            preferences = {}
        return UserProfileOut(
            occupation=p.occupation, domains=domains, preferences=preferences,
            auto_update=p.auto_update, custom_prompt=p.custom_prompt,
            updated_at=p.updated_at,
        )

    async def update_profile(self, db: AsyncSession, update: UserProfileUpdate) -> UserProfileOut:
        stmt = select(DbProfile).where(DbProfile.id == 1)
        p = (await db.execute(stmt)).scalar_one_or_none()
        if not p:
            p = DbProfile(id=1)
            db.add(p)
            await db.flush()
        if update.occupation is not None:
            p.occupation = update.occupation
        if update.domains is not None:
            p.domains_json = json.dumps(update.domains, ensure_ascii=False)
        if update.preferences is not None:
            p.preferences_json = json.dumps(update.preferences, ensure_ascii=False)
        if update.auto_update is not None:
            p.auto_update = update.auto_update
        if update.custom_prompt is not None:
            p.custom_prompt = update.custom_prompt
        p.updated_at = datetime.utcnow()
        await db.commit()
        return await self.get_profile(db)

    def format_profile_for_prompt(self, profile: UserProfileOut) -> str:
        lines = []
        if profile.occupation:
            lines.append(f"- 职业：{profile.occupation}")
        if profile.domains:
            lines.append(f"- 关注领域：{', '.join(profile.domains)}")
        if profile.preferences:
            lines.append(f"- 回答偏好：{json.dumps(profile.preferences, ensure_ascii=False)}")
        if profile.custom_prompt:
            lines.append(f"- 自定义提示：{profile.custom_prompt}")
        return "\n".join(lines) if lines else "- 默认用户画像"

    async def create_long_term_memory(self, db: AsyncSession, data: LongTermMemoryCreate) -> LongTermMemoryOut:
        m = DbLTM(
            content=data.content, source_type=data.source_type,
            importance_score=data.importance_score,
            tags_json=json.dumps(data.tags, ensure_ascii=False),
            status="active",
        )
        db.add(m)
        await db.commit()
        await db.refresh(m)
        return await self._out(m)

    async def list_long_term_memories(self, db: AsyncSession, keyword: str = "",
                                      status: str = "active",
                                      page: int = 1, page_size: int = 20) -> dict:
        q = select(DbLTM).where(DbLTM.status == status)
        if keyword:
            q = q.where(DbLTM.content.like(f"%{keyword}%"))
        q = q.order_by(DbLTM.importance_score.desc(), DbLTM.created_at.desc())
        total_q = select(db.func.count(DbLTM.id)).select_from(DbLTM).where(DbLTM.status == status)
        if keyword:
            total_q = total_q.where(DbLTM.content.like(f"%{keyword}%"))
        total = (await db.execute(total_q)).scalar_one() or 0
        q = q.offset((page - 1) * page_size).limit(page_size)
        items = (await db.execute(q)).scalars().all()
        outs = [await self._out(m) for m in items]
        return {"items": outs, "pagination": {"total": total, "page": page, "page_size": page_size}}

    async def delete_long_term_memory(self, db: AsyncSession, memory_id: int) -> dict:
        stmt = select(DbLTM).where(DbLTM.id == memory_id)
        m = (await db.execute(stmt)).scalar_one_or_none()
        if not m:
            from ...core.exceptions import DocumentNotFoundError
            raise DocumentNotFoundError("记忆不存在")
        m.status = "archived"
        await db.commit()
        return {"id": memory_id, "archived": True}

    async def _out(self, m: DbLTM) -> LongTermMemoryOut:
        tags: list[str] = []
        try:
            tags = json.loads(m.tags_json) if m.tags_json else []
        except Exception:
            tags = []
        return LongTermMemoryOut(
            id=m.id, content=m.content, source_type=m.source_type,
            importance_score=m.importance_score, tags=tags,
            access_count=m.access_count, last_accessed_at=m.last_accessed_at,
            status=m.status, created_at=m.created_at, updated_at=m.updated_at,
        )
