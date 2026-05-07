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
