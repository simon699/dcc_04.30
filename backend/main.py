"""DCC API — Python 后端入口，可按业务扩展路由。"""

from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from wecom_jssdk import agent_signature_for_url, corp_signature_for_url

app = FastAPI(title="DCC API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/wecom/jssdk/corp-signature")
async def wecom_corp_signature(
    url: str = Query(..., description="当前页面完整 URL（不含 hash），与浏览器地址栏一致"),
) -> dict[str, int | str]:
    """企业身份 JS-SDK 签名（jsapi_ticket）。"""
    try:
        return await corp_signature_for_url(url)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/api/wecom/jssdk/agent-signature")
async def wecom_agent_signature(
    url: str = Query(..., description="当前页面完整 URL（不含 hash）"),
) -> dict[str, int | str]:
    """应用身份 JS-SDK 签名（agent_config ticket）。获取外部联系人 userId 等接口需要。"""
    try:
        return await agent_signature_for_url(url)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/api/wecom/config-check")
def wecom_config_check() -> dict[str, bool | str]:
    """是否已配置服务端密钥（不返回密钥本身）。"""
    ok = bool(os.environ.get("WECOM_CORP_ID", "").strip()) and bool(
        os.environ.get("WECOM_CORP_SECRET", "").strip()
    )
    return {"configured": ok}
