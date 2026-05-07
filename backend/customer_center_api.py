"""客户中心：列表与手机号维护。"""

from __future__ import annotations

import os
from math import ceil

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func as sql_func, select
from sqlalchemy.orm import Session

from db import get_session
from models import WecomCustomerFollow, WecomExternalCustomer

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
