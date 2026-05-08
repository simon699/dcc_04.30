/**
 * 客户端群发：将文本投递到企业微信「群发助手」（官方 JS-SDK）。
 *
 * @see https://developer.work.weixin.qq.com/document/path/93555 （shareToExternalContact）
 * @see https://developer.work.weixin.qq.com/document/path/93594 — 文本/附件能力仅 3.1.6+，且 Mac 端暂不支持从网页传入正文；externalUserIds 亦不支持 Mac。
 */

import {
  ensureAgentConfigReady,
  env as wecomEnv,
  register,
  shareToExternalContact,
} from "@wecom/jssdk";

import { formatCaughtError, formatHttpApiDetail } from "@/lib/utils";

function okShareToExternalContact(errMsg: string): boolean {
  return (
    errMsg === "shareToExternalContact:ok" ||
    /shareToExternalContact:ok/i.test(errMsg)
  );
}

async function ensureRegisteredForMassSend(): Promise<void> {
  const corpId = process.env.NEXT_PUBLIC_WECOM_CORP_ID ?? "";
  const agentId = process.env.NEXT_PUBLIC_WECOM_AGENT_ID ?? "";
  if (!corpId.trim() || !agentId.trim()) {
    throw new Error(
      "未配置 NEXT_PUBLIC_WECOM_CORP_ID 或 NEXT_PUBLIC_WECOM_AGENT_ID"
    );
  }

  register({
    corpId: corpId.trim(),
    agentId: Number(agentId.trim()),
    jsApiList: [
      "openEnterpriseChat",
      "getCurExternalContact",
      "shareToExternalContact",
    ],
    getConfigSignature: async (url) => {
      const r = await fetch(
        `/api/wecom/jssdk/corp-signature?url=${encodeURIComponent(url)}`
      );
      if (!r.ok) {
        const detail = await r.json().catch(() => ({}));
        throw new Error(formatHttpApiDetail(detail) || (await r.text()));
      }
      return r.json() as Promise<{
        timestamp: number | string;
        nonceStr: string;
        signature: string;
      }>;
    },
    getAgentConfigSignature: async (url) => {
      const r = await fetch(
        `/api/wecom/jssdk/agent-signature?url=${encodeURIComponent(url)}`
      );
      if (!r.ok) {
        const detail = await r.json().catch(() => ({}));
        throw new Error(formatHttpApiDetail(detail) || (await r.text()));
      }
      return r.json() as Promise<{
        timestamp: number | string;
        nonceStr: string;
        signature: string;
      }>;
    },
  });

  await ensureAgentConfigReady();
}

/**
 * 是否在「企业微信内置浏览器 + macOS 桌面」环境。
 * 官方文档明确：通过网页向群发助手传入 text / externalUserIds 在 Mac 端不可用或受限，
 * 典型现象为助手内正文与客户为空，关闭后回调 shareToExternalContact:cancel。
 */
export function isWeComMacMassSendLimited(): boolean {
  if (typeof navigator === "undefined" || !wecomEnv.isWeCom) {
    return false;
  }
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod|Android/i.test(ua)) {
    return false;
  }
  return /Macintosh|Mac OS X/i.test(ua);
}

function formatShareToExternalContactError(e: unknown): string {
  if (e && typeof e === "object") {
    const o = e as { errMsg?: string; err_msg?: string };
    const errMsg = (o.errMsg ?? o.err_msg ?? "").trim();
    if (errMsg) {
      if (/shareToExternalContact:cancel/i.test(errMsg)) {
        return (
          "已关闭群发助手未发送。若在助手内看不到正文或客户，多为客户端版本过低（建议 3.1.6+）或 Mac 端网页侧官方不支持传入内容，请使用「复制内容」后粘贴发送。"
        );
      }
      return errMsg;
    }
  }
  return formatCaughtError(e);
}

/**
 * 调用企业微信客户端接口，将文本发往群发助手（可选指定客户 external_userid 列表）。
 */
export async function shareMassSendTextToExternalContacts(params: {
  content: string;
  externalUserIds: string[];
}): Promise<{ ok: boolean; message?: string }> {
  const raw = (params.content ?? "").trim();
  if (!raw) {
    return { ok: false, message: "群发内容为空" };
  }
  const ids = [...new Set(params.externalUserIds.map((x) => x.trim()).filter(Boolean))];
  if (ids.length === 0) {
    return { ok: false, message: "缺少外部联系人 ID，无法定向群发" };
  }

  if (typeof window === "undefined") {
    return { ok: false, message: "仅可在浏览器环境中调用" };
  }

  if (!wecomEnv.isWeCom) {
    return {
      ok: false,
      message: "请在企业微信客户端内使用「发起群发」（依赖 JS-SDK shareToExternalContact）",
    };
  }

  if (isWeComMacMassSendLimited()) {
    return {
      ok: false,
      message:
        "Mac 端企业微信网页暂不支持向群发助手传入正文与预选客户（官方文档约 93594）。请使用「复制内容」，在手机端企业微信或 Windows 客户端内再发起群发。",
    };
  }

  const text = raw.length > 4000 ? raw.slice(0, 4000) : raw;

  try {
    await ensureRegisteredForMassSend();
    const res = await shareToExternalContact({
      externalUserIds: ids,
      text: { content: text },
    });
    if (!okShareToExternalContact(res.errMsg)) {
      return { ok: false, message: res.errMsg || "shareToExternalContact 失败" };
    }
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, message: formatShareToExternalContactError(e) };
  }
}
