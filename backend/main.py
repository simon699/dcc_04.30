"""DCC API — Python 后端入口，可按业务扩展路由。"""

from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from customer_center_api import router as customer_center_router
from leads_api import router as leads_router
from tasks_api import router as tasks_router
from customer_sync import last_sync_result, run_customer_sync_and_remember
from wecom_jssdk import agent_signature_for_url, corp_signature_for_url

app = FastAPI(title="DCC API", version="0.1.0")
app.include_router(customer_center_router)
app.include_router(leads_router)
app.include_router(tasks_router)

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


@app.get("/api/wecom/sync/customers/last")
def wecom_sync_customers_last() -> dict[str, object]:
    """最近一次客户同步结果（内存；进程重启后清空）。"""
    last = last_sync_result()
    if last is None:
        return {"ok": False, "message": "尚未执行过同步"}
    return {"ok": True, "result": last}


@app.post("/api/wecom/sync/customers")
async def wecom_sync_customers() -> dict[str, object]:
    """
    拉取「配置了客户联系」的成员（92571）及客户数据写入 MySQL。
    需配置 MYSQL_URL，且应用须在「客户联系可调用接口的应用」内；服务端出口 IP 已在企业微信可信 IP。
    """
    if not os.environ.get("MYSQL_URL", "").strip():
        raise HTTPException(
            status_code=503,
            detail="缺少 MYSQL_URL，请在环境变量中配置，例如 mysql+pymysql://user:pass@127.0.0.1:3306/dcc",
        )

    try:
        result = await run_customer_sync_and_remember()
        return {"ok": True, "result": result}
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
