"""线索 wecom_leads / wecom_leads_follow REST API。"""

from __future__ import annotations

import os
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func as sql_func, or_, select
from sqlalchemy.orm import Session

from db import get_session
from models import WecomLead, WecomLeadFollow

router = APIRouter()

DEFAULT_OWNER_USERID = "ShiFengwei"


def _require_mysql() -> None:
    if not os.environ.get("MYSQL_URL", "").strip():
        raise HTTPException(status_code=503, detail="未配置 MYSQL_URL")


def _parse_date(d: str | None) -> date | None:
    if not d or not str(d).strip():
        return None
    try:
        return date.fromisoformat(str(d).strip()[:10])
    except ValueError:
        return None


def _dt_iso(v: datetime | None) -> str | None:
    if v is None:
        return None
    return v.isoformat()


@router.get("/api/leads")
def list_leads(
    page: int = Query(1, ge=1),
    page_size: int = Query(8, ge=1, le=100),
    keyword: str = Query("", description="手机号、姓名或 external_userid 模糊"),
    customer_level: str = Query("", description="空为全部"),
    intent_model: str = Query("", description="空为全部"),
    next_follow_date: str = Query("", description="YYYY-MM-DD，按下次跟进日筛选"),
    created_date: str = Query("", description="YYYY-MM-DD，按创建日筛选"),
    owner_userid: str = Query("", description="空为全部归属人"),
) -> dict[str, Any]:
    _require_mysql()
    sess: Session = get_session()
    try:
        next_sub = (
            select(
                WecomLeadFollow.lead_id.label("lead_id"),
                sql_func.max(WecomLeadFollow.next_follow_at).label("next_follow_up_at"),
            )
            .group_by(WecomLeadFollow.lead_id)
            .subquery()
        )
        count_follow = (
            select(
                WecomLeadFollow.lead_id.label("lead_id"),
                sql_func.count().label("cnt"),
            )
            .group_by(WecomLeadFollow.lead_id)
            .subquery()
        )

        stmt = (
            select(
                WecomLead,
                next_sub.c.next_follow_up_at,
                count_follow.c.cnt,
            )
            .outerjoin(next_sub, WecomLead.id == next_sub.c.lead_id)
            .outerjoin(count_follow, WecomLead.id == count_follow.c.lead_id)
        )

        kw = keyword.strip()
        if kw:
            stmt = stmt.where(
                or_(
                    WecomLead.phone.contains(kw),
                    WecomLead.customer_name.contains(kw),
                    WecomLead.external_userid.contains(kw),
                )
            )
        if customer_level.strip():
            stmt = stmt.where(WecomLead.customer_level == customer_level.strip())
        if intent_model.strip():
            stmt = stmt.where(WecomLead.intent_model == intent_model.strip())
        if owner_userid.strip():
            stmt = stmt.where(WecomLead.owner_userid == owner_userid.strip())

        cd = _parse_date(created_date)
        if cd:
            stmt = stmt.where(sql_func.date(WecomLead.created_at) == cd)

        nfd = _parse_date(next_follow_date)
        if nfd:
            stmt = stmt.where(sql_func.date(next_sub.c.next_follow_up_at) == nfd)

        id_subq = stmt.with_only_columns(WecomLead.id).order_by(None).subquery()
        total = int(sess.execute(select(sql_func.count()).select_from(id_subq)).scalar_one() or 0)

        stmt = stmt.order_by(WecomLead.id.desc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        rows = sess.execute(stmt).all()

        items = []
        for lead, next_follow, follow_cnt in rows:
            fc = int(follow_cnt or 0)
            items.append(
                {
                    "id": str(lead.id),
                    "phone": lead.phone,
                    "customer_name": lead.customer_name,
                    "external_userid": lead.external_userid,
                    "created_at": _dt_iso(lead.created_at),
                    "intent_model": lead.intent_model,
                    "customer_level": lead.customer_level,
                    "owner_userid": lead.owner_userid,
                    "next_follow_up_at": _dt_iso(next_follow),
                    "follow_count": fc,
                    "status": "following" if fc > 0 else "new",
                }
            )

        total_pages = (total + page_size - 1) // page_size if total else 0
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
        }
    finally:
        sess.close()


class LeadCreate(BaseModel):
    phone: str = Field(default="", max_length=32)
    customer_name: str = Field(default="", max_length=255)
    external_userid: str | None = Field(None, max_length=128)
    intent_model: str | None = Field(None, max_length=255)
    customer_level: str | None = Field(None, max_length=64)
    owner_userid: str = Field(default=DEFAULT_OWNER_USERID, max_length=64)


@router.post("/api/leads")
def create_lead(body: LeadCreate) -> dict[str, Any]:
    _require_mysql()
    phone_s = (body.phone or "").strip()
    ext_s = (body.external_userid or "").strip()
    if not phone_s and not ext_s:
        raise HTTPException(
            status_code=400,
            detail="手机号与 external_userid 须至少填写其一",
        )
    sess = get_session()
    try:
        owner = (body.owner_userid or DEFAULT_OWNER_USERID).strip() or DEFAULT_OWNER_USERID
        lead = WecomLead(
            phone=phone_s or "",
            customer_name=(body.customer_name or "").strip(),
            external_userid=ext_s or None,
            intent_model=(body.intent_model or "").strip() or None,
            customer_level=(body.customer_level or "").strip() or None,
            owner_userid=owner,
        )
        sess.add(lead)
        sess.commit()
        sess.refresh(lead)
        return {
            "ok": True,
            "id": str(lead.id),
            "lead": {
                "id": str(lead.id),
                "phone": lead.phone,
                "customer_name": lead.customer_name,
                "owner_userid": lead.owner_userid,
            },
        }
    except Exception:
        sess.rollback()
        raise
    finally:
        sess.close()


class LeadAssign(BaseModel):
    owner_userid: str = Field(..., min_length=1, max_length=64)


@router.patch("/api/leads/{lead_id}/owner")
def assign_lead_owner(lead_id: int, body: LeadAssign) -> dict[str, bool]:
    _require_mysql()
    sess = get_session()
    try:
        row = sess.get(WecomLead, lead_id)
        if row is None:
            raise HTTPException(status_code=404, detail="线索不存在")
        row.owner_userid = body.owner_userid.strip()
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


@router.get("/api/leads/{lead_id}")
def get_lead_detail(lead_id: int) -> dict[str, Any]:
    _require_mysql()
    sess = get_session()
    try:
        lead = sess.get(WecomLead, lead_id)
        if lead is None:
            raise HTTPException(status_code=404, detail="线索不存在")

        follows = sess.scalars(
            select(WecomLeadFollow)
            .where(WecomLeadFollow.lead_id == lead_id)
            .order_by(WecomLeadFollow.follow_at.desc())
        ).all()

        follow_rows = [
            {
                "id": f.id,
                "follow_at": _dt_iso(f.follow_at),
                "remark": f.remark,
                "next_follow_at": _dt_iso(f.next_follow_at),
                "follow_method": f.follow_method,
            }
            for f in follows
        ]

        next_up = None
        for f in follows:
            if f.next_follow_at:
                if next_up is None or f.next_follow_at > next_up:
                    next_up = f.next_follow_at
        if next_up is None and follows:
            for f in follows:
                if f.next_follow_at:
                    next_up = f.next_follow_at
                    break

        latest_note = follows[0].remark if follows else None

        return {
            "id": str(lead.id),
            "phone": lead.phone,
            "customer_name": lead.customer_name,
            "external_userid": lead.external_userid,
            "created_at": _dt_iso(lead.created_at),
            "intent_model": lead.intent_model,
            "customer_level": lead.customer_level,
            "owner_userid": lead.owner_userid,
            "updated_at": _dt_iso(lead.updated_at),
            "next_follow_up_at": _dt_iso(next_up),
            "latest_remark": latest_note,
            "follow_count": len(follows),
            "status": "following" if follows else "new",
            "follows": follow_rows,
        }
    finally:
        sess.close()


class LeadFollowCreate(BaseModel):
    follow_at: str | None = Field(None, description="ISO 时间，默认当前")
    remark: str | None = None
    next_follow_at: str | None = None
    follow_method: str | None = Field(None, max_length=64)


@router.post("/api/leads/{lead_id}/follows")
def add_lead_follow(lead_id: int, body: LeadFollowCreate) -> dict[str, Any]:
    _require_mysql()
    sess = get_session()
    try:
        lead = sess.get(WecomLead, lead_id)
        if lead is None:
            raise HTTPException(status_code=404, detail="线索不存在")

        fa = body.follow_at
        if fa:
            try:
                follow_at = datetime.fromisoformat(fa.replace("Z", "+00:00"))
            except ValueError:
                follow_at = datetime.utcnow()
        else:
            follow_at = datetime.utcnow()

        def parse_opt_dt(s: str | None) -> datetime | None:
            if not s or not str(s).strip():
                return None
            try:
                return datetime.fromisoformat(str(s).replace("Z", "+00:00"))
            except ValueError:
                return None

        nf = parse_opt_dt(body.next_follow_at)

        rec = WecomLeadFollow(
            lead_id=lead_id,
            follow_at=follow_at,
            remark=(body.remark or "").strip() or None,
            next_follow_at=nf,
            follow_method=(body.follow_method or "").strip() or None,
        )
        sess.add(rec)
        sess.commit()
        sess.refresh(rec)
        return {"ok": True, "id": rec.id}
    except HTTPException:
        sess.rollback()
        raise
    except Exception:
        sess.rollback()
        raise
    finally:
        sess.close()
