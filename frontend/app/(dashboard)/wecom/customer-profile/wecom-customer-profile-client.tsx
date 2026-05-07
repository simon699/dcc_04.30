"use client";

import * as React from "react";
import { getCurExternalContact, register, env as wecomEnv } from "@wecom/jssdk";
import { MessageCircle, Phone, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  getDemoLeadRowDisplay,
  getLead,
  getLeadDetailDisplay,
  getLeadFollowRecords,
} from "@/lib/mock-data";
import {
  expandWecomGetCurExternalContactError,
  formatCaughtError,
  formatHttpApiDetail,
} from "@/lib/utils";

type ExternalContactSdkState =
  | { kind: "loading" }
  | { kind: "success"; userId: string }
  | { kind: "error"; message: string };

export function WecomCustomerProfileClient({
  leadId,
  autoOpenFollow = false,
}: {
  leadId?: string;
  autoOpenFollow?: boolean;
}) {
  const corpId = process.env.NEXT_PUBLIC_WECOM_CORP_ID ?? "";
  const agentId = process.env.NEXT_PUBLIC_WECOM_AGENT_ID ?? "";

  const lead = getLead(leadId ?? "l1") ?? getLead("l1");
  const [followOpen, setFollowOpen] = React.useState(autoOpenFollow);
  const [followNote, setFollowNote] = React.useState("");
  const [nextFollowAt, setNextFollowAt] = React.useState("");
  const [externalContact, setExternalContact] = React.useState<ExternalContactSdkState>(() => {
    if (!corpId.trim() || !agentId.trim()) {
      return {
        kind: "error",
        message:
          "未配置 NEXT_PUBLIC_WECOM_CORP_ID 或 NEXT_PUBLIC_WECOM_AGENT_ID；后端需配置 WECOM_CORP_ID、WECOM_CORP_SECRET。",
      };
    }
    return { kind: "loading" };
  });
  const [wecomClientHint, setWecomClientHint] = React.useState(false);

  React.useEffect(() => {
    setWecomClientHint(!wecomEnv.isWeCom);
  }, []);

  React.useEffect(() => {
    if (!corpId.trim() || !agentId.trim()) return;

    let cancelled = false;
    (async () => {
      try {
        register({
          corpId: corpId.trim(),
          agentId: Number(agentId.trim()),
          jsApiList: ["getCurExternalContact", "openEnterpriseChat"],
          getConfigSignature: async (url) => {
            console.info("[WeCom] corp-signature url=", url);
            const r = await fetch(
              `/api/wecom/jssdk/corp-signature?url=${encodeURIComponent(url)}`,
            );
            if (!r.ok) {
              const detail = await r.json().catch(() => ({}));
              const text = formatHttpApiDetail(detail) || (await r.text());
              console.warn("[WeCom] corp-signature failed", r.status, text);
              throw new Error(text);
            }
            const sig = await r.json();
            console.info("[WeCom] corp-signature ok");
            return sig as { timestamp: number | string; nonceStr: string; signature: string };
          },
          getAgentConfigSignature: async (url) => {
            console.info("[WeCom] agent-signature url=", url);
            const r = await fetch(
              `/api/wecom/jssdk/agent-signature?url=${encodeURIComponent(url)}`,
            );
            if (!r.ok) {
              const detail = await r.json().catch(() => ({}));
              const text = formatHttpApiDetail(detail) || (await r.text());
              console.warn("[WeCom] agent-signature failed", r.status, text);
              throw new Error(text);
            }
            const sig = await r.json();
            console.info("[WeCom] agent-signature ok", sig);
            return sig as { timestamp: number | string; nonceStr: string; signature: string };
          },
        });
        console.info("[WeCom] calling getCurExternalContact …");
        const res = await getCurExternalContact();
        console.info("[WeCom] getCurExternalContact raw=", JSON.stringify(res));
        if (cancelled) return;
        if (res.errMsg === "getCurExternalContact:ok") {
          const uid = res.userId;
          if (typeof uid === "string" && uid.length > 0) {
            setExternalContact({ kind: "success", userId: uid });
          } else {
            setExternalContact({
              kind: "error",
              message: `接口返回成功但缺少 userId：${JSON.stringify(res)}`,
            });
          }
        } else {
          const raw =
            typeof res.errMsg === "string"
              ? res.errMsg
              : `getCurExternalContact 异常：${JSON.stringify(res)}`;
          setExternalContact({
            kind: "error",
            message: expandWecomGetCurExternalContactError(raw),
          });
        }
      } catch (e) {
        if (cancelled) return;
        const message = formatCaughtError(e);
        console.warn("[WeCom] flow error", message, e);
        setExternalContact({
          kind: "error",
          message,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [corpId, agentId]);

  if (!lead) return null;

  const detail = getLeadDetailDisplay(lead);
  const demo = getDemoLeadRowDisplay(lead);
  const records = getLeadFollowRecords(lead.id);
  const phoneDisplay = lead.phone ? lead.phone.replace(/^\+86/, "") : "无手机号";

  return (
    <div className="mx-auto w-full max-w-md space-y-4 pb-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">外部联系人 userId</CardTitle>
          <p className="text-sm font-normal text-muted-foreground">
            接口{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">ww.getCurExternalContact</code>{" "}
            （
            <a
              className="underline underline-offset-2"
              href="https://developer.work.weixin.qq.com/document/path/100746"
              target="_blank"
              rel="noreferrer"
            >
              文档 100746
            </a>
            ）。返回值为当前外部联系人 userId；须使用应用身份完成{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">ww.register</code>，且入口需为客户详情或外部单聊工具栏等支持场景。
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {wecomClientHint ? (
            <p className="text-sm text-amber-600 dark:text-amber-500">
              当前不在企业微信内置浏览器中，该接口通常无法返回客户 ID；请在企业微信内从客户会话工具栏等入口打开本页验证。
            </p>
          ) : null}
          {externalContact.kind === "loading" ? (
            <Skeleton className="h-8 w-full max-w-sm" />
          ) : null}
          {externalContact.kind === "success" ? (
            <p className="break-all font-mono text-sm leading-relaxed">{externalContact.userId}</p>
          ) : null}
          {externalContact.kind === "error" ? (
            <p className="whitespace-pre-line text-sm text-destructive leading-relaxed">
              {externalContact.message}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserRound className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground">昵称</p>
              <h1 className="truncate text-xl font-semibold">{lead.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">手机号：{phoneDisplay}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              disabled={!lead.phone}
              onClick={() => {
                setFollowOpen(true);
                if (lead.phone) {
                  window.location.href = `tel:${lead.phone.replace(/\s/g, "")}`;
                } else {
                  toast.message("当前客户无手机号");
                }
              }}
            >
              <Phone className="size-4" />
              电话
            </Button>
            <Button variant="outline" onClick={() => setFollowOpen(true)} className="gap-1">
              <MessageCircle className="size-4" />
              跟进
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="lead" className="w-full">
        <TabsList variant="line" className="w-full justify-start bg-transparent p-0">
          <TabsTrigger value="lead" className="px-3 py-2">
            线索
          </TabsTrigger>
          <TabsTrigger value="track" className="px-3 py-2">
            客户轨迹
          </TabsTrigger>
          <TabsTrigger value="tag" className="px-3 py-2">
            标签
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lead" className="mt-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">线索信息</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <p>
                <span className="text-muted-foreground">意向车型：</span>
                {demo.intentModel}
              </p>
              <p>
                <span className="text-muted-foreground">客户等级：</span>
                {demo.level}
              </p>
              <p>
                <span className="text-muted-foreground">线索产生时间：</span>
                {new Date(detail.createdAt).toLocaleString("zh-CN")}
              </p>
              <p>
                <span className="text-muted-foreground">下次跟进时间：</span>
                {new Date(detail.nextFollowUpAt).toLocaleString("zh-CN")}
              </p>
              <p>
                <span className="text-muted-foreground">备注：</span>
                {detail.note}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="track" className="mt-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">客户跟进时间轴</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {records.map((record) => (
                  <li key={record.id} className="relative pl-5">
                    <span className="absolute left-0 top-1.5 size-2 rounded-full bg-primary" />
                    <p className="text-xs text-muted-foreground">
                      {new Date(record.at).toLocaleString("zh-CN")}
                    </p>
                    <p className="mt-1 text-sm">{record.content}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tag" className="mt-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">标签</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">暂无标签数据</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {followOpen ? (
        <div className="h-[70vh] max-h-[70vh] rounded-t-2xl border bg-background">
          <div className="border-b px-4 py-3 text-left">
            <h3 className="text-base font-medium">跟进处理</h3>
            <p className="text-sm text-muted-foreground">电话和跟进都在此处补充记录</p>
          </div>
          <div className="h-[calc(70vh-57px)] overflow-y-auto px-4 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="h5-next">下次跟进时间</Label>
                <Input
                  id="h5-next"
                  type="datetime-local"
                  value={nextFollowAt}
                  onChange={(e) => setNextFollowAt(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="h5-note">跟进内容</Label>
                <Textarea
                  id="h5-note"
                  value={followNote}
                  onChange={(e) => setFollowNote(e.target.value)}
                  rows={5}
                  placeholder="输入本次沟通内容、客户反馈、下一步动作"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" onClick={() => setFollowOpen(false)}>
                  收起
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFollowNote("");
                    setNextFollowAt("");
                  }}
                >
                  清空
                </Button>
                <Button
                  onClick={() => {
                    toast.success("跟进记录已保存（演示）");
                    setFollowOpen(false);
                  }}
                >
                  保存
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
