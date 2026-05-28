import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

# Must load .env before reading DATABASE_URL — db.py is imported before
# main.py's own load_dotenv() call, so we load it here too (idempotent).
load_dotenv()

_raw_url = os.getenv("DATABASE_URL", "")
# Render provides postgresql:// — asyncpg requires postgresql+asyncpg://
DATABASE_URL = (
    _raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if _raw_url.startswith("postgresql://")
    else _raw_url
)

engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True) if DATABASE_URL else None
AsyncSessionLocal = (
    async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    if engine
    else None
)


class Base(DeclarativeBase):
    pass


@asynccontextmanager
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    if AsyncSessionLocal is None:
        raise RuntimeError("DATABASE_URL is not configured")
    async with AsyncSessionLocal() as session:
        yield session


def db_available() -> bool:
    return engine is not None
