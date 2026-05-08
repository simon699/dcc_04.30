"""企微任务 wecom_task / wecom_task_target REST API。"""

from __future__ import annotations

import os
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import asc, desc, or_, select, func as sql_func
from sqlalchemy.orm import Session, selectinload

from db import get_session
from models import (
    WecomCustomerFollow,
    WecomExternalCustomer,
    WecomLead,
    WecomTask,
    WecomTaskTarget,
)

router = APIRouter()

DEFAULT_CREATOR_USERID = "ShiFengwei"

ALLOWED_TASK_TYPES = frozenset({"mass_send", "follow_up"})
ALLOWED_CHANNELS = frozenset({"phone", "wecom"})
ALLOWED_TASK_STATUS = frozenset({"pending", "in_progress", "done", "cancelled"})
ALLOWED_TARGET_STATUS = frozenset({"pending", "in_progress", "done", "failed"})


def _require_mysql() -> None:
    if not os.environ.get("MYSQL_URL", "").strip():
        raise HTTPException(status_code=503, detail="未配置 MYSQL_URL")


def _dt_iso(v: datetime | None) -> str | None:
    if v is None:
        return None
    return v.isoformat()


def _parse_iso_dt(s: str | None) -> datetime | None:
    if not s or not str(s).strip():
        return None
    try:
        return datetime.fromisoformat(str(s).replace("Z", "+00:00").replace("+00:00", ""))
    except ValueError:
        return None


def _serialize_target(row: WecomTaskTarget) -> dict[str, Any]:
    return {
        "id": row.id,
        "target_external_userid": row.target_external_userid,
        "target_phone": row.target_phone,
        "status": row.status,
        "started_at": _dt_iso(row.started_at),
        "completed_at": _dt_iso(row.completed_at),
        "remark": row.remark,
    }


def _serialize_task(t: WecomTask, targets: list[WecomTaskTarget]) -> dict[str, Any]:
    return {
        "id": str(t.id),
        "task_type": t.task_type,
        "channel": t.channel,
        "name": t.name,
        "description": t.description,
        "mass_content": t.mass_content,
        "created_at": _dt_iso(t.created_at),
        "start_at": _dt_iso(t.start_at),
        "creator_userid": t.creator_userid,
        "status": t.status,
        "deadline": _dt_iso(t.deadline),
        "completed_at": _dt_iso(t.completed_at),
        "updated_at": _dt_iso(t.updated_at),
        "targets": [_serialize_target(x) for x in targets],
    }


def _batch_target_display_names(
    sess: Session,
    pairs: list[tuple[WecomTask, WecomTaskTarget]],
) -> dict[int, str]:
    """external_userid → 昵称（外部联系人表 / 跟进备注）；phone-only → 线索姓名。"""
    ext_ids: set[str] = set()
    phones: set[str] = set()
    for _, tg in pairs:
        if tg.target_external_userid and str(tg.target_external_userid).strip():
            ext_ids.add(str(tg.target_external_userid).strip())
        if tg.target_phone and str(tg.target_phone).strip():
            phones.add(str(tg.target_phone).strip())

    name_by_ext: dict[str, str] = {}
    if ext_ids:
        for ec in sess.scalars(
            select(WecomExternalCustomer).where(
                WecomExternalCustomer.external_userid.in_(ext_ids)
            )
        ).all():
            if (ec.name or "").strip():
                name_by_ext[ec.external_userid] = (ec.name or "").strip()
        for cf in sess.scalars(
            select(WecomCustomerFollow).where(
                WecomCustomerFollow.external_userid.in_(ext_ids)
            )
        ).all():
            if cf.external_userid not in name_by_ext and (cf.remark or "").strip():
                name_by_ext[cf.external_userid] = (cf.remark or "").strip()

    name_by_phone: dict[str, str] = {}
    if phones:
        conds = [WecomLead.phone == p for p in phones]
        for lead in sess.scalars(select(WecomLead).where(or_(*conds))).all():
            ph = (lead.phone or "").strip()
            if ph and (lead.customer_name or "").strip():
                name_by_phone[ph] = (lead.customer_name or "").strip()

    out: dict[int, str] = {}
    for _, tg in pairs:
        ext = (tg.target_external_userid or "").strip()
        ph = (tg.target_phone or "").strip()
        label = ""
        if ext:
            label = name_by_ext.get(ext, "") or ext
        elif ph:
            label = name_by_phone.get(ph, "") or ph
        else:
            label = "—"
        out[tg.id] = label
    return out


def _maybe_refresh_task_done(sess: Session, task_id: int) -> None:
    """若全部对象已 done/failed 中视为完成，可在此扩展规则；当前仅同步 completed_at 供前端展示。"""
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


@router.get("/api/task-rows")
def list_task_rows(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    channel: str = Query("", description="phone / wecom"),
    task_status: str = Query("", description="任务状态"),
    keyword: str = Query("", description="任务名称模糊"),
    row_status: str = Query(
        "",
        description="对象状态筛选 pending/in_progress/done/failed，空为全部",
    ),
    target_external_userid: str = Query(
        "",
        description="按外部联系人过滤任务对象行",
    ),
    deadline_on: str = Query(
        "",
        description="任务截止日期为某日（YYYY-MM-DD），按日历日匹配",
    ),
    deadline_sort: str = Query(
        "",
        description="deadline_on 有值时可选 asc/desc，按任务 deadline 排序",
    ),
    creator_userid: str = Query(
        "",
        description="任务创建人 userid，空为不限",
    ),
    target_pending_only: bool = Query(
        False,
        description="为 true 时仅含对象状态为 pending/in_progress/failed 的行",
    ),
) -> dict[str, Any]:
    """任务中心：按任务对象展平，一行一个客户。"""
    _require_mysql()
    sess: Session = get_session()
    try:
        base_join = WecomTask.__table__.join(
            WecomTaskTarget.__table__,
            WecomTaskTarget.task_id == WecomTask.id,
        )
        count_stmt = select(sql_func.count()).select_from(base_join)
        stmt = select(WecomTask, WecomTaskTarget).join(
            WecomTaskTarget,
            WecomTaskTarget.task_id == WecomTask.id,
        )
        if channel.strip() and channel.strip() in ALLOWED_CHANNELS:
            stmt = stmt.where(WecomTask.channel == channel.strip())
            count_stmt = count_stmt.where(WecomTask.channel == channel.strip())
        if task_status.strip():
            stmt = stmt.where(WecomTask.status == task_status.strip())
            count_stmt = count_stmt.where(WecomTask.status == task_status.strip())
        kw = keyword.strip()
        if kw:
            stmt = stmt.where(WecomTask.name.contains(kw))
            count_stmt = count_stmt.where(WecomTask.name.contains(kw))
        if row_status.strip():
            stmt = stmt.where(WecomTaskTarget.status == row_status.strip())
            count_stmt = count_stmt.where(WecomTaskTarget.status == row_status.strip())
        tex = target_external_userid.strip()
        if tex:
            stmt = stmt.where(WecomTaskTarget.target_external_userid == tex)
            count_stmt = count_stmt.where(
                WecomTaskTarget.target_external_userid == tex
            )

        dod = deadline_on.strip()
        if dod:
            try:
                dcut = date.fromisoformat(dod)
            except ValueError:
                raise HTTPException(
                    status_code=400, detail="deadline_on 须为 YYYY-MM-DD"
                )
            stmt = stmt.where(
                WecomTask.deadline.isnot(None),
                sql_func.date(WecomTask.deadline) == dcut,
            )
            count_stmt = count_stmt.where(
                WecomTask.deadline.isnot(None),
                sql_func.date(WecomTask.deadline) == dcut,
            )

        cc = creator_userid.strip()
        if cc:
            stmt = stmt.where(WecomTask.creator_userid == cc)
            count_stmt = count_stmt.where(WecomTask.creator_userid == cc)

        if target_pending_only:
            stmt = stmt.where(
                WecomTaskTarget.status.in_(("pending", "in_progress", "failed"))
            )
            count_stmt = count_stmt.where(
                WecomTaskTarget.status.in_(("pending", "in_progress", "failed"))
            )

        total = int(sess.execute(count_stmt).scalar_one() or 0)

        ds = deadline_sort.strip().lower()
        if dod and ds == "asc":
            stmt = stmt.order_by(
                asc(WecomTask.deadline), WecomTask.id.asc(), WecomTaskTarget.id.asc()
            )
        elif dod and ds == "desc":
            stmt = stmt.order_by(
                desc(WecomTask.deadline), WecomTask.id.desc(), WecomTaskTarget.id.asc()
            )
        else:
            stmt = stmt.order_by(WecomTask.id.desc(), WecomTaskTarget.id.asc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        pairs = sess.execute(stmt).all()

        name_map = _batch_target_display_names(sess, list(pairs))

        flat: list[dict[str, Any]] = []
        for t, tg in pairs:
            flat.append(
                {
                    "row_id": f"{t.id}-{tg.id}",
                    "task": _serialize_task(t, []),
                    "target": _serialize_target(tg),
                    "target_display_name": name_map.get(tg.id, "—"),
                }
            )

        total_pages = (total + page_size - 1) // page_size if total else 0
        return {
            "items": flat,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
        }
    finally:
        sess.close()


@router.get("/api/tasks")
def list_tasks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    channel: str = Query("", description="phone / wecom，空为全部"),
    status: str = Query("", description="任务状态，空为全部"),
    keyword: str = Query("", description="任务名称模糊"),
) -> dict[str, Any]:
    _require_mysql()
    sess: Session = get_session()
    try:
        stmt = select(WecomTask).options(selectinload(WecomTask.targets))
        if channel.strip() and channel.strip() in ALLOWED_CHANNELS:
            stmt = stmt.where(WecomTask.channel == channel.strip())
        if status.strip():
            stmt = stmt.where(WecomTask.status == status.strip())
        kw = keyword.strip()
        if kw:
            stmt = stmt.where(WecomTask.name.contains(kw))

        count_stmt = select(sql_func.count()).select_from(
            stmt.with_only_columns(WecomTask.id).order_by(None).subquery()
        )
        total = int(sess.execute(count_stmt).scalar_one() or 0)

        stmt = stmt.order_by(WecomTask.id.desc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        rows = sess.scalars(stmt).unique().all()

        items = [_serialize_task(t, list(t.targets)) for t in rows]
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


@router.get("/api/tasks/{task_id}")
def get_task(task_id: int) -> dict[str, Any]:
    _require_mysql()
    sess = get_session()
    try:
        t = sess.scalars(
            select(WecomTask)
            .options(selectinload(WecomTask.targets))
            .where(WecomTask.id == task_id)
        ).first()
        if t is None:
            raise HTTPException(status_code=404, detail="任务不存在")
        targets = sorted(t.targets, key=lambda x: x.id)
        pairs = [(t, tg) for tg in targets]
        name_map = _batch_target_display_names(sess, pairs)
        out = _serialize_task(t, targets)
        aug: list[dict[str, Any]] = []
        for tg in targets:
            row = _serialize_target(tg)
            row["target_display_name"] = name_map.get(tg.id, "—")
            aug.append(row)
        out["targets"] = aug
        return out
    finally:
        sess.close()


class TargetIn(BaseModel):
    target_external_userid: str | None = None
    target_phone: str | None = None

    @model_validator(mode="after")
    def need_ext_or_phone(self) -> TargetIn:
        e = (self.target_external_userid or "").strip()
        p = (self.target_phone or "").strip()
        if not e and not p:
            raise ValueError("每个任务对象须填写 external_userid 或手机号之一")
        return self


class TaskCreate(BaseModel):
    task_type: str = Field(..., description="mass_send | follow_up")
    channel: str = Field(..., description="phone | wecom")
    name: str = Field(..., min_length=1, max_length=512)
    description: str | None = None
    mass_content: str | None = None
    start_at: str | None = None
    deadline: str | None = None
    creator_userid: str = Field(default=DEFAULT_CREATOR_USERID, max_length=64)
    targets: list[TargetIn] = Field(..., min_length=1)


@router.post("/api/tasks")
def create_task(body: TaskCreate) -> dict[str, Any]:
    _require_mysql()
    tt = body.task_type.strip()
    ch = body.channel.strip()
    if tt not in ALLOWED_TASK_TYPES:
        raise HTTPException(status_code=400, detail=f"task_type 须为 {sorted(ALLOWED_TASK_TYPES)}")
    if ch not in ALLOWED_CHANNELS:
        raise HTTPException(status_code=400, detail=f"channel 须为 {sorted(ALLOWED_CHANNELS)}")

    creator = (body.creator_userid or DEFAULT_CREATOR_USERID).strip() or DEFAULT_CREATOR_USERID

    sess = get_session()
    try:
        task = WecomTask(
            task_type=tt,
            channel=ch,
            name=body.name.strip(),
            description=(body.description or "").strip() or None,
            mass_content=(body.mass_content or "").strip() or None,
            start_at=_parse_iso_dt(body.start_at),
            deadline=_parse_iso_dt(body.deadline),
            creator_userid=creator,
            status="pending",
        )
        sess.add(task)
        sess.flush()

        for tin in body.targets:
            ext = (tin.target_external_userid or "").strip() or None
            ph = (tin.target_phone or "").strip() or None
            if not ext and not ph:
                raise HTTPException(status_code=400, detail="任务对象无效")
            sess.add(
                WecomTaskTarget(
                    task_id=task.id,
                    target_external_userid=ext,
                    target_phone=ph,
                    status="pending",
                )
            )

        sess.commit()
        sess.refresh(task)
        targets = sess.scalars(
            select(WecomTaskTarget).where(WecomTaskTarget.task_id == task.id)
        ).all()
        return {"ok": True, "task": _serialize_task(task, list(targets))}
    except HTTPException:
        sess.rollback()
        raise
    except Exception:
        sess.rollback()
        raise
    finally:
        sess.close()


class TaskPatch(BaseModel):
    status: str | None = None
    completed_at: str | None = None


@router.patch("/api/tasks/{task_id}")
def patch_task(task_id: int, body: TaskPatch) -> dict[str, bool]:
    _require_mysql()
    sess = get_session()
    try:
        task = sess.get(WecomTask, task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="任务不存在")
        if body.status is not None:
            st = body.status.strip()
            if st not in ALLOWED_TASK_STATUS:
                raise HTTPException(status_code=400, detail="非法任务状态")
            task.status = st
        if body.completed_at is not None:
            task.completed_at = _parse_iso_dt(body.completed_at)
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


class TargetPatch(BaseModel):
    status: str | None = None
    remark: str | None = None
    started_at: str | None = None
    completed_at: str | None = None


@router.patch("/api/tasks/{task_id}/targets/{target_id}")
def patch_target(task_id: int, target_id: int, body: TargetPatch) -> dict[str, bool]:
    _require_mysql()
    sess = get_session()
    try:
        row = sess.get(WecomTaskTarget, target_id)
        if row is None or row.task_id != task_id:
            raise HTTPException(status_code=404, detail="对象不存在")
        if body.status is not None:
            st = body.status.strip()
            if st not in ALLOWED_TARGET_STATUS:
                raise HTTPException(status_code=400, detail="非法对象状态")
            row.status = st
        if body.remark is not None:
            row.remark = body.remark.strip() or None
        if body.started_at is not None:
            row.started_at = _parse_iso_dt(body.started_at)
        if body.completed_at is not None:
            row.completed_at = _parse_iso_dt(body.completed_at)
        _maybe_refresh_task_done(sess, task_id)
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
