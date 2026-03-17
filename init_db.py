from __future__ import annotations

from backend.app.database import Base, engine
from backend.app import models  # noqa: F401


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    print("Database initialized: tables created (if not existing).")
