"""客户中心：列表与手机号维护。"""

from __future__ import annotations

import os
from datetime import datetime, timedelta
from math import ceil
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func as sql_func, or_, select
from sqlalchemy.orm import Session

from db import get_session
from models import (
    WecomCustomerFollow,
    WecomExternalCustomer,
    WecomLead,
    WecomLeadFollow,
    WecomTask,
    WecomTaskTarget,
)


def _dt_iso(v: datetime | None) -> str | None:
    if v is None:
        return None
    return v.isoformat()

router = APIRouter()


def _task_channel_label(ch: str | None) -> str:
    x = (ch or "").strip().lower()
    if x == "phone":
        return "电话"
    if x == "wecom":
        return "企微"
    return ch or "—"


def _task_type_label(tt: str | None) -> str:
    x = (tt or "").strip().lower()
    if x == "mass_send":
        return "群发"
    if x == "follow_up":
        return "跟进"
    return tt or "—"


def _related_follow_up_tasks_around(
    sess: Session,
    ext: str,
    phones: list[str],
    follow_at: datetime,
) -> tuple[str | None, str | None]:
    """线索跟进同一时刻关联的跟进任务：刚完成的对象与新建任务名称。"""
    tgt_conds: list[Any] = [WecomTaskTarget.target_external_userid == ext]
    for ph in phones:
        tgt_conds.append(WecomTaskTarget.target_phone == ph)
    tgt_where = or_(*tgt_conds)

    window = timedelta(seconds=20)
    w0 = follow_at - window
    w1 = follow_at + window

    completed_row = sess.execute(
        select(WecomTaskTarget, WecomTask)
        .join(WecomTask, WecomTaskTarget.task_id == WecomTask.id)
        .where(
            tgt_where,
            WecomTask.task_type == "follow_up",
            WecomTaskTarget.completed_at.isnot(None),
            WecomTaskTarget.completed_at >= w0,
            WecomTaskTarget.completed_at <= w1,
        )
        .order_by(WecomTaskTarget.completed_at.desc())
        .limit(1)
    ).first()
    completed_name = completed_row[1].name if completed_row else None

    created_row = sess.execute(
        select(WecomTaskTarget, WecomTask)
        .join(WecomTask, WecomTaskTarget.task_id == WecomTask.id)
        .where(
            tgt_where,
            WecomTask.task_type == "follow_up",
            WecomTask.created_at >= w0,
            WecomTask.created_at <= w1,
        )
        .order_by(WecomTask.created_at.desc())
        .limit(1)
    ).first()
    new_name = created_row[1].name if created_row else None

    return completed_name, new_name


def _require_mysql() -> None:
    if not os.environ.get("MYSQL_URL", "").strip():
        raise HTTPException(
            status_code=503,
            detail="未配置 MYSQL_URL",
        )


@router.get("/api/customers")
def list_customers(
    follow_userid: str = Query("ShiFengwei", description="跟进成员 userid"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    _require_mysql()
    sess: Session = get_session()
    try:
        base = select(WecomCustomerFollow, WecomExternalCustomer).outerjoin(
            WecomExternalCustomer,
            WecomExternalCustomer.external_userid == WecomCustomerFollow.external_userid,
        ).where(WecomCustomerFollow.follow_userid == follow_userid)

        count_stmt = (
            select(sql_func.count())
            .select_from(WecomCustomerFollow)
            .where(WecomCustomerFollow.follow_userid == follow_userid)
        )
        total = int(sess.execute(count_stmt).scalar_one() or 0)

        stmt = (
            base.order_by(WecomCustomerFollow.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = sess.execute(stmt).all()

        items = []
        for f, e in rows:
            items.append(
                {
                    "id": f.id,
                    "follow_userid": f.follow_userid,
                    "external_userid": f.external_userid,
                    "remark": f.remark,
                    "phone": f.phone,
                    "createtime": f.createtime,
                    "name": e.name if e else None,
                    "avatar": e.avatar if e else None,
                    "corp_name": e.corp_name if e else None,
                    "corp_full_name": e.corp_full_name if e else None,
                    "type": e.type if e else None,
                    "position": e.position if e else None,
                }
            )

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": ceil(total / page_size) if total else 0,
            "follow_userid": follow_userid,
        }
    finally:
        sess.close()


@router.get("/api/customers/options")
def list_customer_options(
    follow_userid: str = Query("ShiFengwei", description="跟进成员 userid"),
    limit: int = Query(500, ge=1, le=2000),
) -> dict[str, Any]:
    """下拉框用：精简客户列表（昵称/备注 + external_userid）。"""
    _require_mysql()
    fu = follow_userid.strip()
    sess: Session = get_session()
    try:
        stmt = (
            select(WecomCustomerFollow, WecomExternalCustomer)
            .outerjoin(
                WecomExternalCustomer,
                WecomExternalCustomer.external_userid == WecomCustomerFollow.external_userid,
            )
            .where(WecomCustomerFollow.follow_userid == fu)
            .order_by(WecomCustomerFollow.id.desc())
            .limit(limit)
        )
        rows = sess.execute(stmt).all()
        items: list[dict[str, Any]] = []
        for f, e in rows:
            remark_p = (f.remark or "").strip()
            name_p = ((e.name if e else None) or "").strip()
            label = remark_p or name_p or f.external_userid
            items.append(
                {
                    "external_userid": f.external_userid,
                    "phone": f.phone,
                    "label": label,
                }
            )
        return {"items": items, "follow_userid": fu}
    finally:
        sess.close()


class PhoneUpdate(BaseModel):
    follow_userid: str = Field(..., min_length=1)
    external_userid: str = Field(..., min_length=1)
    phone: str | None = Field(None, description="空字符串表示清空")


@router.patch("/api/customers/phone")
def update_customer_phone(body: PhoneUpdate) -> dict[str, bool]:
    _require_mysql()
    sess = get_session()
    try:
        stmt = select(WecomCustomerFollow).where(
            WecomCustomerFollow.follow_userid == body.follow_userid.strip(),
            WecomCustomerFollow.external_userid == body.external_userid.strip(),
        )
        row = sess.scalars(stmt).first()
        if row is None:
            raise HTTPException(status_code=404, detail="未找到该跟进记录")

        if body.phone is None:
            row.phone = None
        else:
            stripped = body.phone.strip()
            row.phone = stripped if stripped else None

        sess.commit()
        return {"ok": True}
    except HTTPException:
        sess.rollback()
        raise
    except Exception:
        sess.rollback()
        raise
    finally:
        sess.close()


@router.get("/api/customers/profile")
def customer_profile(
    follow_userid: str = Query(..., description="跟进成员 userid"),
    external_userid: str = Query(..., description="外部联系人 external_userid"),
) -> dict[str, Any]:
    """合并客户跟进行 + 外部联系人主档，用于侧边栏 / 抽屉展示。"""
    _require_mysql()
    ext = external_userid.strip()
    fu = follow_userid.strip()
    if not ext:
        raise HTTPException(status_code=400, detail="缺少 external_userid")

    sess: Session = get_session()
    try:
        follow = sess.scalars(
            select(WecomCustomerFollow).where(
                WecomCustomerFollow.follow_userid == fu,
                WecomCustomerFollow.external_userid == ext,
            )
        ).first()

        ec = sess.scalars(
            select(WecomExternalCustomer).where(
                WecomExternalCustomer.external_userid == ext,
            )
        ).first()

        display_name = ""
        if ec and (ec.name or "").strip():
            display_name = (ec.name or "").strip()
        elif follow and (follow.remark or "").strip():
            display_name = (follow.remark or "").strip()
        else:
            display_name = ext

        return {
            "external_userid": ext,
            "follow_userid": fu,
            "follow_row_id": follow.id if follow else None,
            "display_name": display_name,
            "phone": follow.phone if follow else None,
            "remark": follow.remark if follow else None,
            "avatar": ec.avatar if ec else None,
            "corp_name": (ec.corp_full_name or ec.corp_name) if ec else None,
            "position": ec.position if ec else None,
            "tags_json": follow.tags_json if follow else None,
            "tag_id_json": follow.tag_id_json if follow else None,
            "external_profile": {
                "name": ec.name if ec else None,
                "type": ec.type if ec else None,
                "gender": ec.gender if ec else None,
            }
            if ec
            else None,
        }
    finally:
        sess.close()


@router.get("/api/customers/timeline")
def customer_timeline(
    external_userid: str = Query(...),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    """客户轨迹：线索跟进、任务创建、任务完成等。"""
    _require_mysql()
    ext = external_userid.strip()
    if not ext:
        raise HTTPException(status_code=400, detail="缺少 external_userid")

    sess: Session = get_session()
    try:
        events: list[dict[str, Any]] = []

        lead_rows = sess.scalars(
            select(WecomLead).where(WecomLead.external_userid == ext)
        ).all()
        lead_ids = [r.id for r in lead_rows]
        phones = list(
            {
                (r.phone or "").strip()
                for r in lead_rows
                if (r.phone or "").strip()
            }
        )

        if lead_ids:
            follows = sess.scalars(
                select(WecomLeadFollow)
                .where(WecomLeadFollow.lead_id.in_(lead_ids))
                .order_by(WecomLeadFollow.follow_at.desc())
                .limit(limit * 3)
            ).all()
            for f in follows:
                rm = (f.remark or "").strip()
                prior_name, next_name = _related_follow_up_tasks_around(
                    sess, ext, phones, f.follow_at
                )
                ev_follow: dict[str, Any] = {
                    "at": _dt_iso(f.follow_at),
                    "kind": "lead_follow",
                    "title": "线索跟进",
                    "detail": rm,
                    "remark": rm,
                    "next_follow_at": _dt_iso(f.next_follow_at),
                    "follow_method": f.follow_method,
                    "lead_id": str(f.lead_id),
                }
                if prior_name:
                    ev_follow["completed_prior_task_name"] = prior_name
                if next_name:
                    ev_follow["new_follow_task_name"] = next_name
                events.append(ev_follow)

        tgt_conds: list[Any] = [WecomTaskTarget.target_external_userid == ext]
        for ph in phones:
            tgt_conds.append(WecomTaskTarget.target_phone == ph)
        tgt_where = or_(*tgt_conds)

        tgt_rows = sess.execute(
            select(WecomTaskTarget, WecomTask)
            .join(WecomTask, WecomTaskTarget.task_id == WecomTask.id)
            .where(tgt_where)
            .order_by(WecomTask.created_at.desc())
            .limit(limit * 8)
        ).all()

        seen_task_created: set[int] = set()
        for tg, task in tgt_rows:
            tid = int(task.id)
            if tid not in seen_task_created:
                seen_task_created.add(tid)
                dl = _dt_iso(task.deadline)
                events.append(
                    {
                        "at": _dt_iso(task.created_at),
                        "kind": "task_created",
                        "title": f"创建任务 · {task.name}",
                        "detail": (
                            f"{_task_type_label(task.task_type)} · "
                            f"{_task_channel_label(task.channel)}"
                            + (f" · 截止 {dl}" if dl else "")
                        ),
                        "task_id": str(task.id),
                        "task_name": task.name,
                        "task_deadline": dl,
                        "channel": task.channel,
                        "task_type": task.task_type,
                    }
                )

            if tg.status == "done" and tg.completed_at:
                tr = (tg.remark or "").strip()
                events.append(
                    {
                        "at": _dt_iso(tg.completed_at),
                        "kind": "task_completed",
                        "title": f"完成任务 · {task.name}",
                        "detail": tr or "对象已完成",
                        "task_id": str(task.id),
                        "task_name": task.name,
                        "target_remark": tr or None,
                        "channel": task.channel,
                    }
                )

        events.sort(key=lambda x: x.get("at") or "", reverse=True)
        return {"items": events[:limit]}
    finally:
        sess.close()
