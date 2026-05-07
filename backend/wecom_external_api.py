"""企业微信客户联系服务端 API（文档 91039 token、92571 跟进成员、92113 客户列表、批量客户详情）。"""

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
    # 文档字段名为 external_userid，值为 id 数组
    raw = data.get("external_userid")
    if raw is None:
        raw = data.get("external_userids")
    return list(raw or [])


async def externalcontact_get(
    client: httpx.AsyncClient, access_token: str, external_userid: str
) -> dict[str, Any]:
    """92114 获取客户详情（单客户）"""
    r = await client.get(
        f"{QYAPI}/externalcontact/get",
        params={"access_token": access_token, "external_userid": external_userid},
    )
    r.raise_for_status()
    data = r.json()
    await _ensure_ok(data)
    return data


async def batch_get_by_user_page(
    client: httpx.AsyncClient,
    access_token: str,
    userid: str,
    cursor: str,
    limit: int = 100,
) -> tuple[list[dict[str, Any]], str]:
    """
    批量获取客户详情。优先 body: {userid, cursor, limit}；
    若企业返回参数错误则改用 userid_list（兼容部分环境）。
    """
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

    # 兼容：部分文档示意为 userid_list
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
    """某个跟进成员下全部客户明细（优先批量接口；失败则 list + get）。"""
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
        logger.info("batch/get_by_user 不可用，降级 list+get：userid=%s err=%s", userid, ex)
        batch_ok = False

    if batch_ok:
        return out

    # 降级：92113 + 92114
    out = []
    ext_ids = await externalcontact_list_external_ids(client, access_token, userid)
    for eid in ext_ids:
        detail = await externalcontact_get(client, access_token, eid)
        ec = detail.get("external_contact") or {}
        # 单客户详情里跟进信息多为 follow_info 数组
        follow_infos = detail.get("follow_info")
        if follow_infos is None:
            follow_infos = detail.get("follow_user")
        if not isinstance(follow_infos, list):
            follow_infos = [follow_infos] if follow_infos else []
        for fi in follow_infos:
            if not isinstance(fi, dict):
                continue
            out.append({"external_contact": ec, "follow_info": fi})
    return out


async def collect_all_customer_rows() -> tuple[list[str], list[dict[str, Any]]]:
    """
    拉取全部跟进成员及其客户明细。
    返回：(follow_userids, rows)，rows 每项含 external_contact、follow_info 字典。
    """
    token = await get_access_token()
    async with httpx.AsyncClient(timeout=60.0) as client:
        follow_users = await get_follow_user_list(client, token)
        rows: list[dict[str, Any]] = []
        for uid in follow_users:
            batches = await fetch_customer_batches_for_follow_user(client, token, uid)
            rows.extend(batches)
        return follow_users, rows
