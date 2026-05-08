"""工作面板 KPI（今日跟进线索、今日任务统计）。"""

from __future__ import annotations

import os
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func as sql_func, select

from db import get_session
from models import WecomLead, WecomLeadFollow, WecomTask, WecomTaskTarget

router = APIRouter()


def _dt_iso(v: datetime | None) -> str | None:
    if v is None:
        return None
    return v.isoformat()


def _require_mysql() -> None:
    if not os.environ.get("MYSQL_URL", "").strip():
        raise HTTPException(status_code=503, detail="未配置 MYSQL_URL")


@router.get("/api/panel/today-kpis")
def today_kpis(
    owner_userid: str = Query(
        "",
        description="线索归属人 userid，空表示不按归属过滤（全员线索）",
    ),
    creator_userid: str = Query(
        "",
        description="任务创建人 userid，空表示不按创建人过滤",
    ),
) -> dict[str, Any]:
    """今日：下次跟进落在今日的线索数；截止日期为今日的任务对象统计。"""
    _require_mysql()
    today_d = date.today()

    sess = get_session()
    try:
        # —— 线索：每条线索取跟进表中最大的 next_follow_at，落在今日且非空
        nf_sq = (
            select(
                WecomLeadFollow.lead_id.label("lead_id"),
                sql_func.max(WecomLeadFollow.next_follow_at).label("mx_nf"),
            )
            .where(WecomLeadFollow.next_follow_at.isnot(None))
            .group_by(WecomLeadFollow.lead_id)
        ).subquery()

        lc_stmt = select(sql_func.count()).select_from(
            nf_sq.join(WecomLead, WecomLead.id == nf_sq.c.lead_id)
        ).where(sql_func.date(nf_sq.c.mx_nf) == today_d)
        ow = owner_userid.strip()
        if ow:
            lc_stmt = lc_stmt.where(WecomLead.owner_userid == ow)

        leads_next_follow_today = int(sess.execute(lc_stmt).scalar_one() or 0)

        # —— 任务对象：任务截止日期为今日（任务未取消）
        base_join = WecomTask.__table__.join(
            WecomTaskTarget.__table__,
            WecomTaskTarget.task_id == WecomTask.id,
        )
        fc = (
            select(sql_func.count())
            .select_from(base_join)
            .where(
                WecomTask.deadline.isnot(None),
                sql_func.date(WecomTask.deadline) == today_d,
                WecomTask.status != "cancelled",
            )
        )
        cr = creator_userid.strip()
        if cr:
            fc = fc.where(WecomTask.creator_userid == cr)

        tasks_due_today_total = int(sess.execute(fc).scalar_one() or 0)

        fc_done = (
            select(sql_func.count())
            .select_from(base_join)
            .where(
                WecomTask.deadline.isnot(None),
                sql_func.date(WecomTask.deadline) == today_d,
                WecomTask.status != "cancelled",
                WecomTaskTarget.status == "done",
            )
        )
        if cr:
            fc_done = fc_done.where(WecomTask.creator_userid == cr)

        tasks_done_today = int(sess.execute(fc_done).scalar_one() or 0)

        tasks_undone_today = max(0, tasks_due_today_total - tasks_done_today)

        return {
            "date": today_d.isoformat(),
            "leads_next_follow_today": leads_next_follow_today,
            "tasks_due_today_total": tasks_due_today_total,
            "tasks_done_today": tasks_done_today,
            "tasks_undone_today": tasks_undone_today,
        }
    finally:
        sess.close()


@router.get("/api/panel/today-phone-follows")
def today_phone_follows(
    owner_userid: str = Query(
        "",
        description="线索归属人 userid，空为不按归属过滤",
    ),
) -> dict[str, Any]:
    """今日已记录的电话跟进（跟进方式=电话），含客户姓名、手机号、通话时长。"""
    _require_mysql()
    today_d = date.today()
    sess = get_session()
    try:
        stmt = (
            select(WecomLeadFollow, WecomLead)
            .join(WecomLead, WecomLead.id == WecomLeadFollow.lead_id)
            .where(
                sql_func.date(WecomLeadFollow.follow_at) == today_d,
                WecomLeadFollow.follow_method == "phone",
            )
            .order_by(WecomLeadFollow.follow_at.desc())
        )
        ow = owner_userid.strip()
        if ow:
            stmt = stmt.where(WecomLead.owner_userid == ow)
        rows = sess.execute(stmt).all()
        items: list[dict[str, Any]] = []
        for f, lead in rows:
            items.append(
                {
                    "follow_id": f.id,
                    "follow_at": _dt_iso(f.follow_at),
                    "customer_name": (lead.customer_name or "").strip() or "—",
                    "phone": (lead.phone or "").strip() or "—",
                    "call_duration_seconds": f.call_duration_seconds,
                }
            )
        return {"date": today_d.isoformat(), "items": items}
    finally:
        sess.close()
