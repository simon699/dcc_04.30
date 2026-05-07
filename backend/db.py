"""MySQL 连接（同步 Session，供同步任务在线程池中使用）。"""

from __future__ import annotations

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

_engine = None
_session_factory: sessionmaker[Session] | None = None


def get_mysql_url() -> str:
    url = os.environ.get("MYSQL_URL", "").strip()
    if not url:
        raise RuntimeError(
            "缺少环境变量 MYSQL_URL，例如 mysql+pymysql://user:pass@127.0.0.1:3306/dcc",
        )
    return url


def engine():
    global _engine
    if _engine is None:
        _engine = create_engine(
            get_mysql_url(),
            pool_pre_ping=True,
            pool_recycle=3600,
            echo=False,
        )
    return _engine


def get_session() -> Session:
    global _session_factory
    if _session_factory is None:
        _session_factory = sessionmaker(bind=engine(), autoflush=False, autocommit=False)
    return _session_factory()
