"""企业微信客户联系服务端 API（91039 token、92571、92113、92114、批量详情）。"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from wecom_jssdk import QYAPI, get_access_token

logger = logging.getLogger(__name__)

HeadersJson = {"Content-Type": "application/json"}


async def _ensure_ok(data: dict[str, Any]) -> None:
    if data.get("errcode", 0) != 0:
        raise RuntimeError(f"企业微信 API 错误: {data}")


async def get_follow_user_list(client: httpx.AsyncClient, access_token: str) -> list[str]:
    """92571 get_follow_user_list"""
    r = await client.get(
        f"{QYAPI}/externalcontact/get_follow_user_list",
        params={"access_token": access_token},
    )
    r.raise_for_status()
    data = r.json()
    await _ensure_ok(data)
    return list(data.get("follow_user") or [])


async def externalcontact_list_external_ids(
    client: httpx.AsyncClient, access_token: str, userid: str
) -> list[str]:
    """92113 获取客户 external_userid 列表"""
    r = await client.get(
        f"{QYAPI}/externalcontact/list",
        params={"access_token": access_token, "userid": userid},
    )
    r.raise_for_status()
    data = r.json()
    await _ensure_ok(data)
    raw = data.get("external_userid")
    if raw is None:
        raw = data.get("external_userids")
    return list(raw or [])


async def externalcontact_get(
    client: httpx.AsyncClient, access_token: str, external_userid: str
) -> dict[str, Any]:
    """92114 获取客户详情（单页，不含 cursor 翻页）"""
    r = await client.get(
        f"{QYAPI}/externalcontact/get",
        params={"access_token": access_token, "external_userid": external_userid},
    )
    r.raise_for_status()
    data = r.json()
    await _ensure_ok(data)
    return data


async def externalcontact_get_all_pages(
    client: httpx.AsyncClient, access_token: str, external_userid: str
) -> dict[str, Any]:
    """
    92114 获取客户详情（含 follow_user 全部分页，跟进人超过 500 时需 cursor）。
    返回 {"external_contact": dict, "follow_user": [ ... ]}
    """
    cursor = ""
    external_contact: dict[str, Any] = {}
    follow_users: list[dict[str, Any]] = []
    while True:
        params: dict[str, str] = {
            "access_token": access_token,
            "external_userid": external_userid,
        }
        if cursor:
            params["cursor"] = cursor
        r = await client.get(f"{QYAPI}/externalcontact/get", params=params)
        r.raise_for_status()
        data = r.json()
        await _ensure_ok(data)
        if not external_contact:
            external_contact = dict(data.get("external_contact") or {})
        chunk = data.get("follow_user")
        if isinstance(chunk, list):
            follow_users.extend(chunk)
        elif isinstance(chunk, dict):
            follow_users.append(chunk)
        next_c = str(data.get("next_cursor") or "").strip()
        if not next_c:
            break
        cursor = next_c
    if not external_contact.get("external_userid"):
        external_contact["external_userid"] = external_userid
    return {"external_contact": external_contact, "follow_user": follow_users}


def normalize_follow_user_from_92114(fu: dict[str, Any]) -> dict[str, Any]:
    """92114 的 follow_user 使用 tags[]；持久化层仍使用 follow_info 命名。"""
    out = dict(fu)
    tags = fu.get("tags")
    if isinstance(tags, list):
        tag_ids = [
            t["tag_id"]
            for t in tags
            if isinstance(t, dict) and t.get("tag_id")
        ]
        if tag_ids:
            out.setdefault("tag_id", tag_ids)
    return out


async def batch_get_by_user_page(
    client: httpx.AsyncClient,
    access_token: str,
    userid: str,
    cursor: str,
    limit: int = 100,
) -> tuple[list[dict[str, Any]], str]:
    """批量获取客户详情（辅助：92113 失败时用于发现 external_userid）。"""
    url = f"{QYAPI}/externalcontact/batch/get_by_user"
    params = {"access_token": access_token}

    body_primary: dict[str, Any] = {"userid": userid, "cursor": cursor, "limit": limit}
    r = await client.post(url, params=params, json=body_primary, headers=HeadersJson)
    r.raise_for_status()
    data = r.json()

    if data.get("errcode") == 0:
        lst = list(data.get("external_contact_list") or [])
        next_c = str(data.get("next_cursor") or "")
        return lst, next_c

    body_alt: dict[str, Any] = {"userid_list": [userid], "cursor": cursor, "limit": limit}
    r2 = await client.post(url, params=params, json=body_alt, headers=HeadersJson)
    r2.raise_for_status()
    data2 = r2.json()
    await _ensure_ok(data2)
    lst = list(data2.get("external_contact_list") or [])
    next_c = str(data2.get("next_cursor") or "")
    return lst, next_c


async def fetch_customer_batches_for_follow_user(
    client: httpx.AsyncClient, access_token: str, userid: str
) -> list[dict[str, Any]]:
    """仅用于发现客户 ID（92113 失败时的兜底），数据仍以 92114 为准。"""
    out: list[dict[str, Any]] = []
    cursor = ""
    batch_ok = False
    try:
        while True:
            page, next_cursor = await batch_get_by_user_page(
                client, access_token, userid, cursor
            )
            batch_ok = True
            out.extend(page)
            if not next_cursor:
                break
            cursor = next_cursor
    except Exception as ex:
        logger.info("batch/get_by_user 不可用 userid=%s err=%s", userid, ex)
        batch_ok = False

    if batch_ok:
        return out

    out = []
    ext_ids = await externalcontact_list_external_ids(client, access_token, userid)
    for eid in ext_ids:
        detail = await externalcontact_get_all_pages(client, access_token, eid)
        ec = detail.get("external_contact") or {}
        for fu in detail.get("follow_user") or []:
            if isinstance(fu, dict):
                out.append(
                    {"external_contact": ec, "follow_info": normalize_follow_user_from_92114(fu)}
                )
    return out


async def discover_external_userids(
    client: httpx.AsyncClient, token: str, follow_users: list[str]
) -> set[str]:
    """用 92113 列出各跟进人的客户；失败则尝试批量接口解析 external_userid。"""
    ids: set[str] = set()
    for uid in follow_users:
        try:
            part = await externalcontact_list_external_ids(client, token, uid)
            ids.update(part)
        except Exception as ex:
            logger.warning("92113 失败 userid=%s，改用批量/兜底发现客户: %s", uid, ex)
            batches = await fetch_customer_batches_for_follow_user(client, token, uid)
            for row in batches:
                ec = row.get("external_contact") if isinstance(row, dict) else None
                if isinstance(ec, dict) and ec.get("external_userid"):
                    ids.add(ec["external_userid"])
    return ids


async def collect_all_customer_rows() -> tuple[list[str], list[dict[str, Any]]]:
    """
    同步主路径：92571 跟进成员 → 92113 收集 external_userid → 对每个客户 92114（含 cursor）拉详情。
    """
    token = await get_access_token()
    rows: list[dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=120.0) as client:
        follow_users = await get_follow_user_list(client, token)
        unique_eids = await discover_external_userids(client, token, follow_users)
        for eid in sorted(unique_eids):
            detail = await externalcontact_get_all_pages(client, token, eid)
            ec = detail["external_contact"]
            for fu in detail["follow_user"]:
                if not isinstance(fu, dict):
                    continue
                fi = normalize_follow_user_from_92114(fu)
                rows.append({"external_contact": ec, "follow_info": fi})
        return follow_users, rows
