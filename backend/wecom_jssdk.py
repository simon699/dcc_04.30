"""企业微信 JS-SDK 签名（服务端）：corp jsapi_ticket + agent_config ticket。"""

from __future__ import annotations

import asyncio
import hashlib
import os
import secrets
import time
from typing import Any

import httpx

QYAPI = "https://qyapi.weixin.qq.com/cgi-bin"

_lock = asyncio.Lock()
_access_token: str | None = None
_access_expires_at = 0.0
_jsapi_ticket: str | None = None
_jsapi_expires_at = 0.0
_agent_ticket: str | None = None
_agent_expires_at = 0.0


def _require_config() -> tuple[str, str]:
    corp_id = os.environ.get("WECOM_CORP_ID", "").strip()
    secret = os.environ.get("WECOM_CORP_SECRET", "").strip()
    if not corp_id or not secret:
        raise RuntimeError("缺少环境变量 WECOM_CORP_ID 或 WECOM_CORP_SECRET")
    return corp_id, secret


async def _fetch_json(client: httpx.AsyncClient, url: str, params: dict[str, str]) -> dict[str, Any]:
    r = await client.get(url, params=params)
    r.raise_for_status()
    data = r.json()
    if data.get("errcode", 0) != 0:
        raise RuntimeError(f"企业微信 API 错误: {data}")
    return data


async def get_access_token() -> str:
    """获取 access_token（带缓存，与其它 ticket 刷新共用一把锁）。"""
    global _access_token, _access_expires_at, _jsapi_ticket, _agent_ticket
    now = time.time()
    if _access_token and now < _access_expires_at - 120:
        return _access_token
    async with _lock:
        now = time.time()
        if _access_token and now < _access_expires_at - 120:
            return _access_token
        corp_id, secret = _require_config()
        async with httpx.AsyncClient(timeout=15.0) as client:
            data = await _fetch_json(
                client,
                f"{QYAPI}/gettoken",
                {"corpid": corp_id, "corpsecret": secret},
            )
        _access_token = data["access_token"]
        _access_expires_at = time.time() + float(data.get("expires_in", 7200))
        _jsapi_ticket = None
        _agent_ticket = None
        return _access_token


async def get_corp_jsapi_ticket() -> str:
    global _jsapi_ticket, _jsapi_expires_at
    now = time.time()
    if _jsapi_ticket and now < _jsapi_expires_at - 120:
        return _jsapi_ticket
    # 先拿到 token（内部自已占锁），避免在持有本模块 ticket 锁时再嵌套申请 token 锁导致死锁
    token = await get_access_token()
    async with _lock:
        now = time.time()
        if _jsapi_ticket and now < _jsapi_expires_at - 120:
            return _jsapi_ticket
        async with httpx.AsyncClient(timeout=15.0) as client:
            data = await _fetch_json(
                client,
                f"{QYAPI}/get_jsapi_ticket",
                {"access_token": token},
            )
        _jsapi_ticket = data["ticket"]
        _jsapi_expires_at = time.time() + float(data.get("expires_in", 7200))
        return _jsapi_ticket


async def get_agent_jsapi_ticket() -> str:
    global _agent_ticket, _agent_expires_at
    now = time.time()
    if _agent_ticket and now < _agent_expires_at - 120:
        return _agent_ticket
    token = await get_access_token()
    async with _lock:
        now = time.time()
        if _agent_ticket and now < _agent_expires_at - 120:
            return _agent_ticket
        async with httpx.AsyncClient(timeout=15.0) as client:
            data = await _fetch_json(
                client,
                f"{QYAPI}/ticket/get",
                {"access_token": token, "type": "agent_config"},
            )
        _agent_ticket = data["ticket"]
        _agent_expires_at = time.time() + float(data.get("expires_in", 7200))
        return _agent_ticket


def _sign(ticket: str, url: str) -> dict[str, int | str]:
    """附录 JS-SDK 签名算法。"""
    nonce_str = secrets.token_hex(8)
    ts = int(time.time())
    plain = f"jsapi_ticket={ticket}&noncestr={nonce_str}&timestamp={ts}&url={url}"
    signature = hashlib.sha1(plain.encode("utf-8")).hexdigest()
    return {"timestamp": ts, "nonceStr": nonce_str, "signature": signature}


async def corp_signature_for_url(url: str) -> dict[str, int | str]:
    ticket = await get_corp_jsapi_ticket()
    return _sign(ticket, url)


async def agent_signature_for_url(url: str) -> dict[str, int | str]:
    ticket = await get_agent_jsapi_ticket()
    return _sign(ticket, url)
