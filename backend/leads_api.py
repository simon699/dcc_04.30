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
from models import WecomLead, WecomLeadFollow, WecomTask, WecomTaskTarget

router = APIRouter()

DEFAULT_OWNER_USERID = "ShiFengwei"

_ALLOWED_FOLLOW_METHOD = frozenset({"phone", "wecom"})


def _digits_phone(s: str | None) -> str:
    return "".join(c for c in (s or "") if c.isdigit())


def _phones_match_lead(lead_phone: str | None, target_phone: str | None) -> bool:
    a = _digits_phone(lead_phone)
    b = _digits_phone(target_phone)
    return len(a) >= 7 and len(b) >= 7 and a == b


def _maybe_refresh_task_done(sess: Session, task_id: int) -> None:
    """与 tasks_api 一致：全部对象为 done/failed 时标记任务完成。"""
    task = sess.get(WecomTask, task_id)
    if task is None:
        return
    rows = sess.scalars(
        select(WecomTaskTarget).where(WecomTaskTarget.task_id == task_id)
    ).all()
    if not rows:
        return
    all_terminal = all(r.status in ("done", "failed") for r in rows)
    if all_terminal and task.status not in ("done", "cancelled"):
        task.status = "done"
        if task.completed_at is None:
            task.completed_at = datetime.now()


def _target_matches_lead(tg: WecomTaskTarget, lead: WecomLead) -> bool:
    ext_l = (lead.external_userid or "").strip() or None
    ext_t = (tg.target_external_userid or "").strip() or None
    if ext_l and ext_t and ext_l == ext_t:
        return True
    return _phones_match_lead(lead.phone, tg.target_phone)


def _complete_prior_follow_task_for_lead(
    sess: Session,
    lead: WecomLead,
    completed_task_id: int | None,
) -> None:
    """线索再次跟进时，先将上一待办跟进任务视为完成；再写入本次跟进并生成新任务。"""
    now = datetime.utcnow()

    if completed_task_id is not None:
        task = sess.get(WecomTask, completed_task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="指定的跟进任务不存在")
        if task.task_type != "follow_up":
            raise HTTPException(status_code=400, detail="仅跟进任务可通过线索跟进关闭")
        targets = sess.scalars(
            select(WecomTaskTarget).where(
                WecomTaskTarget.task_id == completed_task_id
            )
        ).all()
        if len(targets) != 1:
            raise HTTPException(status_code=400, detail="跟进任务对象异常")
        tg = targets[0]
        if not _target_matches_lead(tg, lead):
            raise HTTPException(status_code=400, detail="任务对象与当前线索不一致")
        if task.status not in ("done", "cancelled") and tg.status not in (
            "done",
            "failed",
        ):
            tg.status = "done"
            tg.completed_at = now
            _maybe_refresh_task_done(sess, completed_task_id)
        return

    stmt = (
        select(WecomTask, WecomTaskTarget)
        .join(WecomTaskTarget, WecomTaskTarget.task_id == WecomTask.id)
        .where(
            WecomTask.task_type == "follow_up",
            WecomTask.status.in_(["pending", "in_progress"]),
            WecomTaskTarget.status.in_(["pending", "in_progress"]),
        )
        .order_by(WecomTask.id.desc())
    )
    pairs = sess.execute(stmt).all()
    for task, tg in pairs:
        if _target_matches_lead(tg, lead):
            tg.status = "done"
            tg.completed_at = now
            _maybe_refresh_task_done(sess, task.id)
            break


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
        # 每条线索取「最新一条跟进记录」（按 follow_at）上的 next_follow_at 与备注
        _rn = sql_func.row_number().over(
            partition_by=WecomLeadFollow.lead_id,
            order_by=(
                WecomLeadFollow.follow_at.desc(),
                WecomLeadFollow.id.desc(),
            ),
        ).label("rn")
        _lf_wrap = (
            select(
                WecomLeadFollow.lead_id,
                WecomLeadFollow.next_follow_at,
                WecomLeadFollow.remark,
                _rn,
            )
        ).subquery()
        lf_latest = (
            select(
                _lf_wrap.c.lead_id,
                _lf_wrap.c.next_follow_at,
                _lf_wrap.c.remark,
            ).where(_lf_wrap.c.rn == 1)
        ).subquery()
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
                lf_latest.c.next_follow_at,
                lf_latest.c.remark,
                count_follow.c.cnt,
            )
            .outerjoin(lf_latest, WecomLead.id == lf_latest.c.lead_id)
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
            stmt = stmt.where(sql_func.date(lf_latest.c.next_follow_at) == nfd)

        id_subq = stmt.with_only_columns(WecomLead.id).order_by(None).subquery()
        total = int(sess.execute(select(sql_func.count()).select_from(id_subq)).scalar_one() or 0)

        stmt = stmt.order_by(WecomLead.id.desc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        rows = sess.execute(stmt).all()

        items = []
        for lead, next_follow, latest_remark, follow_cnt in rows:
            fc = int(follow_cnt or 0)
            lr = (latest_remark or "").strip() if latest_remark is not None else ""
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
                    "latest_follow_remark": lr or None,
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


@router.get("/api/leads/by-external")
def list_leads_by_external_userid(
    external_userid: str = Query(..., description="外部联系人 external_userid"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    """按 external_userid 精确匹配线索列表。须注册在 /api/leads/{lead_id} 之前，否则会命中路径参数。"""
    _require_mysql()
    ext = external_userid.strip()
    if not ext:
        raise HTTPException(status_code=400, detail="缺少 external_userid")

    sess: Session = get_session()
    try:
        stmt = select(WecomLead).where(WecomLead.external_userid == ext)
        count_stmt = select(sql_func.count()).select_from(
            stmt.with_only_columns(WecomLead.id).order_by(None).subquery()
        )
        total = int(sess.execute(count_stmt).scalar_one() or 0)

        stmt = stmt.order_by(WecomLead.id.desc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        leads = sess.scalars(stmt).all()

        items = []
        for lead in leads:
            items.append(
                {
                    "id": str(lead.id),
                    "phone": lead.phone,
                    "customer_name": lead.customer_name,
                    "external_userid": lead.external_userid,
                    "intent_model": lead.intent_model,
                    "customer_level": lead.customer_level,
                    "owner_userid": lead.owner_userid,
                    "created_at": _dt_iso(lead.created_at),
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
        if ext_s:
            dup = sess.scalars(
                select(WecomLead.id).where(WecomLead.external_userid == ext_s).limit(1)
            ).first()
            if dup is not None:
                raise HTTPException(
                    status_code=409,
                    detail="该企微客户已存在线索，每个外部联系人仅可对应一条线索",
                )
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
                "call_duration_seconds": f.call_duration_seconds,
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


def _parse_required_next_follow(s: str) -> datetime:
    raw = str(s).strip()
    if not raw:
        raise HTTPException(status_code=400, detail="下次跟进时间为必填")
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00").replace("+00:00", ""))
    except ValueError as e:
        raise HTTPException(status_code=400, detail="下次跟进时间格式无效") from e


def _deadline_end_of_that_day(dt: datetime) -> datetime:
    """下次跟进时间所在自然日的 23:59:59。"""
    return datetime(dt.year, dt.month, dt.day, 23, 59, 59)


class LeadCompleteFollowBody(BaseModel):
    intent_model: str | None = None
    customer_level: str | None = None
    remark: str | None = None
    invite_store_at: str | None = Field(None, description="邀约到店日期，可选")
    next_follow_at: str = Field(..., min_length=1)
    next_follow_method: str = Field(..., min_length=1, description="phone 或 wecom")
    external_userid: str | None = Field(
        None,
        max_length=128,
        description="未加微时关联企微客户 external_userid（与创建线索规则一致，不可占用其他线索）",
    )
    phone: str | None = Field(
        None,
        max_length=32,
        description="补充线索手机号（线索编辑页无手机号时可提交保存）",
    )
    call_duration_seconds: int | None = Field(
        None,
        ge=0,
        le=86400,
        description="本次电话跟进通话时长（秒），可选",
    )
    completed_task_id: int | None = Field(
        None,
        description="从任务入口跟进时传入：要先标记完成的跟进任务 ID",
    )


@router.post("/api/leads/{lead_id}/complete-follow")
def complete_lead_follow(lead_id: int, body: LeadCompleteFollowBody) -> dict[str, Any]:
    """保存线索字段、写入跟进记录，并按下次跟进时间与方式创建跟进任务。"""
    _require_mysql()
    method = (body.next_follow_method or "").strip().lower()
    if method not in _ALLOWED_FOLLOW_METHOD:
        raise HTTPException(
            status_code=400,
            detail="next_follow_method 须为 phone（电话）或 wecom（微信）",
        )

    nf = _parse_required_next_follow(body.next_follow_at)
    deadline = _deadline_end_of_that_day(nf)

    sess = get_session()
    try:
        lead = sess.get(WecomLead, lead_id)
        if lead is None:
            raise HTTPException(status_code=404, detail="线索不存在")

        if body.intent_model is not None:
            lead.intent_model = (body.intent_model or "").strip() or None
        if body.customer_level is not None:
            lead.customer_level = (body.customer_level or "").strip() or None

        phone_patch = (body.phone or "").strip()
        if phone_patch:
            lead.phone = phone_patch[:32]

        ext_link = (body.external_userid or "").strip() or None
        if ext_link:
            if not (lead.external_userid or "").strip():
                dup_other = sess.scalars(
                    select(WecomLead.id).where(
                        WecomLead.external_userid == ext_link,
                        WecomLead.id != lead_id,
                    ).limit(1)
                ).first()
                if dup_other is not None:
                    raise HTTPException(
                        status_code=409,
                        detail="该企微客户已绑定其他线索，无法重复关联",
                    )
                lead.external_userid = ext_link
                sess.flush()

        _complete_prior_follow_task_for_lead(sess, lead, body.completed_task_id)

        remark_parts: list[str] = []
        if body.remark and str(body.remark).strip():
            remark_parts.append(str(body.remark).strip())
        inv = (body.invite_store_at or "").strip()
        if inv:
            remark_parts.append(f"邀约到店：{inv}")
        remark_final = "\n".join(remark_parts) if remark_parts else None

        ph_now = (lead.phone or "").strip()
        ext_now = (lead.external_userid or "").strip() or None
        if method == "phone" and not ph_now:
            raise HTTPException(
                status_code=400,
                detail="电话跟进须填写线索手机号（可在客户信息中补充）",
            )

        dur = body.call_duration_seconds
        if method != "phone":
            dur = None

        follow_rec = WecomLeadFollow(
            lead_id=lead_id,
            follow_at=datetime.utcnow(),
            remark=remark_final,
            next_follow_at=nf,
            follow_method=method,
            call_duration_seconds=dur,
        )
        sess.add(follow_rec)
        sess.flush()

        cust_label = (lead.customer_name or "").strip() or "客户"
        task_name = f"{cust_label}-线索跟进任务"

        task = WecomTask(
            task_type="follow_up",
            channel=method,
            name=task_name,
            description="线索跟进",
            mass_content=None,
            start_at=None,
            deadline=deadline,
            creator_userid=(lead.owner_userid or DEFAULT_OWNER_USERID).strip()
            or DEFAULT_OWNER_USERID,
            status="pending",
        )
        sess.add(task)
        sess.flush()

        ext = ext_now
        ph = ph_now or None
        if not ext and not ph:
            raise HTTPException(
                status_code=400,
                detail="线索缺少手机号与企微 external_userid，无法生成任务对象",
            )

        sess.add(
            WecomTaskTarget(
                task_id=task.id,
                target_external_userid=ext,
                target_phone=ph if ph else None,
                status="pending",
            )
        )

        sess.commit()
        sess.refresh(follow_rec)
        sess.refresh(task)
        return {
            "ok": True,
            "follow_id": follow_rec.id,
            "task_id": task.id,
        }
    except HTTPException:
        sess.rollback()
        raise
    except Exception:
        sess.rollback()
        raise
    finally:
        sess.close()
