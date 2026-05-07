"""客户中心：列表与手机号维护。"""

from __future__ import annotations

import os
from datetime import datetime
from math import ceil
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func as sql_func, select
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
    """客户轨迹：线索跟进记录 + 任务对象节点（简要）。"""
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
        if lead_ids:
            follows = sess.scalars(
                select(WecomLeadFollow)
                .where(WecomLeadFollow.lead_id.in_(lead_ids))
                .order_by(WecomLeadFollow.follow_at.desc())
                .limit(limit)
            ).all()
            for f in follows:
                events.append(
                    {
                        "at": _dt_iso(f.follow_at),
                        "kind": "lead_follow",
                        "title": "线索跟进",
                        "detail": f.remark or "",
                        "lead_id": str(f.lead_id),
                    }
                )

        tgt_rows = sess.execute(
            select(WecomTaskTarget, WecomTask)
            .join(WecomTask, WecomTaskTarget.task_id == WecomTask.id)
            .where(WecomTaskTarget.target_external_userid == ext)
            .order_by(WecomTask.id.desc())
            .limit(limit)
        ).all()
        for tg, task in tgt_rows:
            t_at = tg.completed_at or tg.started_at or task.created_at
            events.append(
                {
                    "at": _dt_iso(t_at),
                    "kind": "task_target",
                    "title": task.name,
                    "detail": f"对象状态：{tg.status}",
                    "task_id": str(task.id),
                    "target_status": tg.status,
                }
            )

        events.sort(key=lambda x: x.get("at") or "", reverse=True)
        return {"items": events[:limit]}
    finally:
        sess.close()
