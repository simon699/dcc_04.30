import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 将 HTTP JSON 错误体（尤其 FastAPI 的 detail）转成可读字符串，避免出现 [object Object] */
export function formatHttpApiDetail(body: unknown): string {
  if (body === null || body === undefined) return "请求失败";
  if (typeof body === "string") return body;
  if (typeof body !== "object") return String(body);
  const o = body as Record<string, unknown>;
  const d = o.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    return d
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          return String((item as { msg: unknown }).msg);
        }
        try {
          return JSON.stringify(item);
        } catch {
          return String(item);
        }
      })
      .join("; ");
  }
  if (d !== undefined && d !== null && typeof d === "object") {
    try {
      return JSON.stringify(d);
    } catch {
      return String(d);
    }
  }
  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}

/** 企业微信 getCurExternalContact 常见 errMsg 的补充说明（文档 path/100746） */
export function expandWecomGetCurExternalContactError(errMsg: string): string {
  const lower = errMsg.toLowerCase();
  if (
    lower.includes("permission denied") ||
    lower.includes("no permission") ||
    lower.includes("fail no permission")
  ) {
    return `${errMsg}

常见原因（需在管理后台核对）：
1. 当前自建应用未勾选或未保存「客户联系」相关能力（如客户基础信息），或前端 AgentId / 后端 Secret 不是同一个应用。
2. 打开该页的成员不在「客户联系」使用范围内，或未配置为可使用客户联系的员工。
3. 打开入口不符合要求：需从外部单聊工具栏、客户联系人详情等支持场景进入；勿在无任何外部客户上下文时直接打开网页链接测试。

仍失败请对照官方文档「获取当前客户 ID」中的「使用限制」表检查入口类型与企业微信版本。`;
  }
  if (lower.includes("without context")) {
    return `${errMsg}

当前页面没有「当前外部联系人」上下文，请从外部单聊会话上方的应用工具栏或客户详情等入口打开本页。`;
  }
  return errMsg;
}

export function formatCaughtError(e: unknown): string {
  if (e instanceof Error) return e.message || "Error";
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === "string") return m;
    try {
      return JSON.stringify(m);
    } catch {
      return String(m);
    }
  }
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
