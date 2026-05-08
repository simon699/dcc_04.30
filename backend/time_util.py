"""业务默认时区：东八区（与中国大陆常用时间一致，无夏令时切换）。

- 写入 MySQL 的 DATETIME 列为「无时区的本地墙钟时间」，约定表示东八区当地时间。
- API 序列化统一附加 ``+08:00``，便于前端正确解析。
- 解析入参：带 Z / 偏移的 ISO 时间会先换算为东八区再落库；无时区后缀的字符串视为东八区本地墙钟。
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

TZ_CN = timezone(timedelta(hours=8))


def now_cn_naive() -> datetime:
    """当前东八区时间，以 naive datetime 写入数据库。"""
    return datetime.now(TZ_CN).replace(tzinfo=None)


def parse_iso_datetime_cn(s: str | None) -> datetime | None:
    """
    将前端 / 第三方传入的 ISO 字符串转为「东八区墙钟」naive datetime。

    - ``2026-05-08T10:00:00`` → 视为东八区 10:00（原样数值）
    - ``2026-05-08T02:00:00Z`` → 换算为东八区墙钟 10:00
    """
    if s is None or not str(s).strip():
        return None
    raw = str(s).strip()
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(raw)
    except ValueError:
        return None
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(TZ_CN).replace(tzinfo=None)


def format_iso_cn(v: datetime | None) -> str | None:
    """API 输出：带 ``+08:00`` 的 ISO8601（库内 naive 视为东八区墙钟）。"""
    if v is None:
        return None
    if v.tzinfo is None:
        aware = v.replace(tzinfo=TZ_CN)
    else:
        aware = v.astimezone(TZ_CN)
    return aware.isoformat(timespec="seconds")
