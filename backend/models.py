import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID

from db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invite_code = Column(String(100), unique=True, nullable=False, index=True)
    display_name = Column(String(100), nullable=True)
    bio = Column(Text, nullable=True)
    avatar_index = Column(Integer, default=8)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Project(Base):
    __tablename__ = "projects"

    id = Column(String(50), primary_key=True)          # proj-${Date.now()}
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(200), nullable=False)
    status = Column(String(20), default="draft")
    meta = Column(JSONB, nullable=True)                 # ProjectMeta JSON
    snapshot = Column(JSONB, nullable=False)            # full SlideSnapshot
    part5_video_name = Column(String(200), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())


class CommunityLesson(Base):
    __tablename__ = "community_lessons"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(
        String(50),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    published_at = Column(DateTime(timezone=True), server_default=func.now())
