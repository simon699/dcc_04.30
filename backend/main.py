"""DCC API — Python 后端入口，可按业务扩展路由。"""

from fastapi import FastAPI

app = FastAPI(title="DCC API", version="0.1.0")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
