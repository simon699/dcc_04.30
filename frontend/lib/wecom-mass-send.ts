/**
 * 客户端群发：将文本投递到企业微信「群发助手」（官方 JS-SDK）。
 *
 * @see https://developer.work.weixin.qq.com/document/path/93555 （shareToExternalContact）
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
    return { ok: false, message: formatCaughtError(e) };
  }
}
