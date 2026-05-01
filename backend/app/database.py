from __future__ import annotations

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


logger = logging.getLogger(__name__)

# Load .env file if it exists
ENV_FILE = Path(__file__).resolve().parents[2] / ".env"
if ENV_FILE.exists():
    load_dotenv(ENV_FILE)

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DATABASE_URL = "sqlite:///./test.db"
    logger.info("DATABASE_URL not set; falling back to local SQLite database")
else:
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
        logger.info("Normalized postgres:// URL to postgresql:// for SQLAlchemy")


def _create_engine(database_url: str):
    if database_url.startswith("sqlite"):
        logger.info("Initializing SQLite database engine")
        return create_engine(
            database_url,
            connect_args={"check_same_thread": False},
            pool_pre_ping=True,
        )

    logger.info("Initializing PostgreSQL database engine")
    return create_engine(database_url, pool_pre_ping=True)


engine = _create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
