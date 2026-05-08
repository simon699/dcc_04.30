"""线索已关联企微客户时，将线索手机号同步到客户跟进表 phone 字段。"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from models import WecomCustomerFollow, WecomLead


def sync_customer_follow_phone_from_lead(
    sess: Session,
    *,
    external_userid: str,
    follow_userid: str,
) -> None:
    """若存在 external_userid 一致的线索且线索有手机号，则写入对应跟进成员的客户跟进记录。"""
    ext = (external_userid or "").strip()
    fu = (follow_userid or "").strip()
    if not ext or not fu:
        return

    lead = sess.scalars(
        select(WecomLead)
        .where(WecomLead.external_userid == ext)
        .where(WecomLead.owner_userid == fu)
        .order_by(WecomLead.id.desc())
        .limit(1)
    ).first()
    if lead is None:
        lead = sess.scalars(
            select(WecomLead)
            .where(WecomLead.external_userid == ext)
            .order_by(WecomLead.id.desc())
            .limit(1)
        ).first()
    if lead is None:
        return

    ph = (lead.phone or "").strip()
    if not ph:
        return

    row = sess.scalars(
        select(WecomCustomerFollow).where(
            WecomCustomerFollow.follow_userid == fu,
            WecomCustomerFollow.external_userid == ext,
        )
    ).first()
    if row is None:
        return

    row.phone = ph[:32]
