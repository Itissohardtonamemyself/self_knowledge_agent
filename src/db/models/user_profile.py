from __future__ import annotations

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean

from ..session import Base


class UserProfile(Base):
    __tablename__ = "user_profile"

    id = Column(Integer, primary_key=True, default=1)
    occupation = Column(String(128), nullable=False, default="")
    domains_json = Column(Text, nullable=False, default="[]", comment="关注领域 JSON 数组")
    preferences_json = Column(Text, nullable=False, default="{}", comment="偏好 JSON（回答风格等）")
    auto_update = Column(Boolean, nullable=False, default=True)
    custom_prompt = Column(Text, nullable=False, default="")
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
