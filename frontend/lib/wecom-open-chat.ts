/**
 * 在企业微信内打开与外部联系人的会话。
 *
 * @see https://developer.work.weixin.qq.com/document/path/92525 打开会话（ww.openEnterpriseChat）
 */

import {
  ensureAgentConfigReady,
  env as wecomEnv,
  openEnterpriseChat,
  register,
} from "@wecom/jssdk";

import { formatCaughtError, formatHttpApiDetail } from "@/lib/utils";

function okEnterpriseChatErrMsg(errMsg: string): boolean {
  return (
    errMsg === "openEnterpriseChat:ok" ||
    /openEnterpriseChat:ok/i.test(errMsg)
  );
}

export type OpenWecomExternalChatParams = {
  /** 外部联系人 external_userid */
  externalUserid: string;
  /**
   * 参与会话的企业成员 userid（建议传线索归属人，与当前登录成员一致时单聊最稳定）。
   * 不传则仅根据 external_userid 打开（仍须在企业微信内且应用已鉴权）。
   */
  internalUserid?: string | null;
};

/**
 * 在企业微信客户端内调用 JS-SDK 打开会话；非企微环境返回 false（由调用方决定降级 UI）。
 */
export async function openWecomExternalUserChat(
  params: OpenWecomExternalChatParams
): Promise<boolean> {
  const ext = params.externalUserid.trim();
  if (!ext) return false;

  if (typeof window === "undefined") return false;

  if (!wecomEnv.isWeCom) {
    return false;
  }

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
    // 与 wecom-customer-profile-client 等页保持一致，避免 SPA 内反复 register 时互挤掉其它接口
    jsApiList: ["openEnterpriseChat", "getCurExternalContact"],
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

  const internal = (params.internalUserid ?? "").trim();

  const res = await openEnterpriseChat({
    groupName: "",
    ...(internal ? { userIds: [internal] } : {}),
    externalUserIds: [ext],
  });

  if (!okEnterpriseChatErrMsg(res.errMsg)) {
    throw new Error(res.errMsg || "openEnterpriseChat 失败");
  }

  return true;
}

/** 包装一层便于在 UI 中 toast，而不抛出未捕获异常 */
export async function tryOpenWecomExternalUserChat(
  params: OpenWecomExternalChatParams
): Promise<{ ok: boolean; message?: string }> {
  try {
    const ok = await openWecomExternalUserChat(params);
    if (ok) return { ok: true };
    return {
      ok: false,
      message: "当前不在企业微信客户端内，无法打开会话",
    };
  } catch (e: unknown) {
    return { ok: false, message: formatCaughtError(e) };
  }
}
