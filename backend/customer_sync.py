"""将客户联系数据写入 MySQL。"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Any

from sqlalchemy import func
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.orm import Session

from db import get_session
from models import WecomCustomerFollow, WecomExternalCustomer, WecomFollowUser
from wecom_external_api import collect_all_customer_rows

logger = logging.getLogger(__name__)


def _upsert_follow_users(sess: Session, userids: list[str]) -> int:
    n = 0
    for uid in userids:
        stmt = mysql_insert(WecomFollowUser).values(userid=uid)
        stmt = stmt.on_duplicate_key_update(synced_at=func.now())
        sess.execute(stmt)
        n += 1
    return n


def _upsert_external_customer(sess: Session, ec: dict[str, Any]) -> None:
    eid = ec.get("external_userid")
    if not eid:
        return
    prof = ec.get("external_profile")
    values = dict(
        external_userid=eid,
        name=ec.get("name"),
        position=ec.get("position"),
        avatar=ec.get("avatar"),
        corp_name=ec.get("corp_name"),
        corp_full_name=ec.get("corp_full_name"),
        type=ec.get("type"),
        gender=ec.get("gender"),
        unionid=ec.get("unionid"),
        external_profile_json=prof,
        raw_external_contact_json=ec,
    )
    stmt = mysql_insert(WecomExternalCustomer).values(**values)
    stmt = stmt.on_duplicate_key_update(
        name=stmt.inserted.name,
        position=stmt.inserted.position,
        avatar=stmt.inserted.avatar,
        corp_name=stmt.inserted.corp_name,
        corp_full_name=stmt.inserted.corp_full_name,
        type=stmt.inserted.type,
        gender=stmt.inserted.gender,
        unionid=stmt.inserted.unionid,
        external_profile_json=stmt.inserted.external_profile_json,
        raw_external_contact_json=stmt.inserted.raw_external_contact_json,
        synced_at=func.now(),
    )
    sess.execute(stmt)


def _upsert_follow(sess: Session, ec: dict[str, Any], fi: dict[str, Any]) -> None:
    eid = ec.get("external_userid")
    fid = fi.get("userid")
    if not eid or not fid:
        return
    tag_ids = fi.get("tag_id")
    tags_full = fi.get("tags")
    mobiles = fi.get("remark_mobiles")
    values = dict(
        follow_userid=fid,
        external_userid=eid,
        remark=fi.get("remark"),
        remark_corp_name=fi.get("remark_corp_name"),
        description=fi.get("description"),
        createtime=fi.get("createtime"),
        tag_id_json=tag_ids,
        tags_json=tags_full if isinstance(tags_full, list) else None,
        remark_mobiles_json=mobiles,
        state=fi.get("state"),
        add_way=fi.get("add_way"),
        wechat_channels_json=fi.get("wechat_channels"),
        oper_userid=(
            str(fi.get("oper_userid")) if fi.get("oper_userid") is not None else None
        ),
        raw_follow_info_json=fi,
    )
    stmt = mysql_insert(WecomCustomerFollow).values(**values)
    stmt = stmt.on_duplicate_key_update(
        remark=stmt.inserted.remark,
        remark_corp_name=stmt.inserted.remark_corp_name,
        description=stmt.inserted.description,
        createtime=stmt.inserted.createtime,
        tag_id_json=stmt.inserted.tag_id_json,
        tags_json=stmt.inserted.tags_json,
        remark_mobiles_json=stmt.inserted.remark_mobiles_json,
        state=stmt.inserted.state,
        add_way=stmt.inserted.add_way,
        wechat_channels_json=stmt.inserted.wechat_channels_json,
        oper_userid=stmt.inserted.oper_userid,
        raw_follow_info_json=stmt.inserted.raw_follow_info_json,
        synced_at=func.now(),
    )
    sess.execute(stmt)


def persist_rows(follow_userids: list[str], rows: list[dict[str, Any]]) -> dict[str, int]:
    sess = get_session()
    follow_upserted = 0
    customer_upserted = 0
    relation_upserted = 0
    try:
        follow_upserted = _upsert_follow_users(sess, follow_userids)
        seen_customer: set[str] = set()
        for row in rows:
            ec = row.get("external_contact")
            fi = row.get("follow_info")
            if not isinstance(ec, dict) or not isinstance(fi, dict):
                continue
            eid = ec.get("external_userid")
            if eid and eid not in seen_customer:
                _upsert_external_customer(sess, ec)
                seen_customer.add(eid)
                customer_upserted += 1
            _upsert_follow(sess, ec, fi)
            relation_upserted += 1
        sess.commit()
    except Exception:
        sess.rollback()
        raise
    finally:
        sess.close()
    return {
        "follow_users_count": len(follow_userids),
        "follow_users_upserted": follow_upserted,
        "external_customer_distinct": customer_upserted,
        "follow_relations_upserted": relation_upserted,
        "detail_rows_from_api": len(rows),
    }


async def run_customer_sync() -> dict[str, Any]:
    follow_userids, rows = await collect_all_customer_rows()

    def _job():
        return persist_rows(follow_userids, rows)

    stats = await asyncio.to_thread(_job)
    stats["finished_at"] = datetime.utcnow().isoformat() + "Z"
    return stats


_last_sync: dict[str, Any] | None = None


def last_sync_result() -> dict[str, Any] | None:
    return _last_sync


async def run_customer_sync_and_remember() -> dict[str, Any]:
    global _last_sync
    _last_sync = await run_customer_sync()
    return _last_sync
