"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Phone } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { tryOpenWecomExternalUserChat } from "@/lib/wecom-open-chat";
import { useUiStore } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";
import { env as wecomEnv } from "@wecom/jssdk";

/** 与后端 `DEFAULT_OWNER_USERID` / 分配候选人一致 */
export const DEFAULT_LEAD_OWNER_USERID = "ShiFengwei";
export const ASSIGNABLE_OWNER_USERIDS = [
  "ShiFengwei",
  "WangSales",
  "LiuGuwen",
] as const;

export type ApiLeadDetail = {
  id: string;
  phone: string | null;
  customer_name: string | null;
  external_userid?: string | null;
  created_at: string | null;
  intent_model: string | null;
  customer_level: string | null;
  owner_userid: string | null;
  updated_at?: string | null;
  next_follow_up_at: string | null;
  latest_remark: string | null;
  follow_count: number;
  status: string;
  follows: Array<{
    id: number;
    follow_at: string | null;
    remark: string | null;
    next_follow_at: string | null;
    follow_method: string | null;
    call_duration_seconds?: number | null;
  }>;
};

function apiLeadStatusLabel(status: string): string {
  switch (status) {
    case "new":
      return "新线索";
    case "following":
      return "跟进中";
    default:
      return status;
  }
}

function formatPhone(phone?: string | null): string {
  const raw = (phone ?? "").trim();
  if (!raw) return "—";
  if (raw.startsWith("+86")) return raw.slice(3);
  return raw;
}

function followMethodLabel(method: string | null | undefined): string {
  const m = (method ?? "").trim().toLowerCase();
  if (m === "phone") return "电话";
  if (m === "wecom") return "微信";
  if (!method?.trim()) return "—";
  return method.trim();
}

export function LeadDrawerPanel({ leadId }: { leadId: string }) {
  const router = useRouter();
  const openDrawer = useUiStore((s) => s.openDrawer);
  const closeDrawer = useUiStore((s) => s.closeDrawer);

  const [data, setData] = React.useState<ApiLeadDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [selectedOwner, setSelectedOwner] = React.useState("");
  const [openingWecomChat, setOpeningWecomChat] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    setLoadError(null);
    fetch(`/api/leads/${encodeURIComponent(leadId)}`)
      .then(async (r) => {
        if (r.status === 404) {
          setData(null);
          setLoadError("未找到该线索");
          return;
        }
        if (!r.ok) {
          const t = await r.text();
          throw new Error(t || r.statusText);
        }
        return r.json() as Promise<ApiLeadDetail>;
      })
      .then((d) => {
        if (d) setData(d);
      })
      .catch((e: Error) => {
        setData(null);
        setLoadError(e.message || "加载失败");
      })
      .finally(() => setLoading(false));
  }, [leadId]);

  React.useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">加载线索详情…</p>
    );
  }

  if (loadError || !data) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{loadError ?? "无法加载线索"}</p>
        <Button size="sm" variant="outline" onClick={() => load()}>
          重试
        </Button>
      </div>
    );
  }

  const name = (data.customer_name ?? "").trim() || "未命名";
  const hasWecom = Boolean((data.external_userid ?? "").trim());

  function confirmAssign() {
    if (!selectedOwner) return;
    fetch(`/api/leads/${encodeURIComponent(leadId)}/owner`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner_userid: selectedOwner }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const t = await r.text();
          throw new Error(t || r.statusText);
        }
        toast.success(`已转交给 ${selectedOwner}`);
        setAssignOpen(false);
        setSelectedOwner("");
        load();
      })
      .catch((e: Error) => toast.error(e.message || "分配失败"));
  }

  return (
    <>
      <div className="space-y-4">
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">{name}</h3>
            <Badge variant="secondary">{apiLeadStatusLabel(data.status)}</Badge>
          </div>
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            {formatPhone(data.phone)}
          </p>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <p>
              <span className="text-muted-foreground">是否加微信：</span>
              {hasWecom ? "已加微" : "未加微"}
            </p>
            <p>
              <span className="text-muted-foreground">线索产生时间：</span>
              {data.created_at
                ? new Date(data.created_at).toLocaleString("zh-CN")
                : "—"}
            </p>
            <p>
              <span className="text-muted-foreground">下次跟进时间：</span>
              {data.next_follow_up_at
                ? new Date(data.next_follow_up_at).toLocaleString("zh-CN")
                : "—"}
            </p>
            <p>
              <span className="text-muted-foreground">归属人：</span>
              {data.owner_userid ?? "—"}
            </p>
          </div>
          <p className="mt-2 text-sm">
            <span className="text-muted-foreground">最近备注：</span>
            {data.latest_remark?.trim() ? data.latest_remark : "—"}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {data.phone ? (
              <button
                type="button"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "gap-1"
                )}
                onClick={() => {
                  closeDrawer();
                  router.push(`/leads/${data.id}/edit?entry=phone`);
                }}
              >
                <Phone className="size-4" />
                电话
              </button>
            ) : (
              <span
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "pointer-events-none gap-1 text-muted-foreground opacity-60"
                )}
              >
                <Phone className="size-4" />
                无手机号
              </span>
            )}
            {hasWecom ? (
              <Button
                size="sm"
                disabled={openingWecomChat}
                onClick={async () => {
                  const ext = (data.external_userid ?? "").trim();
                  if (!ext) return;
                  setOpeningWecomChat(true);
                  try {
                    const r = await tryOpenWecomExternalUserChat({
                      externalUserid: ext,
                      internalUserid: data.owner_userid,
                    });
                    if (r.ok) return;
                    if (wecomEnv.isWeCom) {
                      toast.error(r.message ?? "无法打开会话");
                      return;
                    }
                    openDrawer({
                      type: "wecom_image",
                      leadId: data.id,
                    });
                  } finally {
                    setOpeningWecomChat(false);
                  }
                }}
              >
                {openingWecomChat ? "打开中…" : "微信"}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="border-dashed"
                onClick={() => toast.message(`向 ${name} 发起加微（演示）`)}
              >
                加微
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                closeDrawer();
                router.push(`/leads/${data.id}/edit?entry=edit`);
              }}
            >
              跟进线索
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
              分配线索
            </Button>
          </div>
        </div>

        <Tabs defaultValue="detail" className="w-full">
          <TabsList variant="line" className="w-full justify-start bg-transparent p-0">
            <TabsTrigger value="detail" className="px-3 py-2">
              详情
            </TabsTrigger>
            <TabsTrigger value="records" className="px-3 py-2">
              跟进记录
            </TabsTrigger>
            <TabsTrigger value="profile" className="px-3 py-2">
              客户画像
            </TabsTrigger>
          </TabsList>
          <TabsContent value="detail" className="mt-3">
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">意向车型</dt>
                <dd className="font-medium">{data.intent_model ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">客户等级</dt>
                <dd>{data.customer_level ?? "—"}</dd>
              </div>
            </dl>
          </TabsContent>
          <TabsContent value="records" className="mt-3">
            {data.follows.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无跟进记录</p>
            ) : (
              <ul className="space-y-4">
                {data.follows.map((r) => (
                  <li key={r.id} className="relative border-l-2 border-primary/25 pl-4">
                    <p className="text-xs font-medium text-muted-foreground">
                      跟进时间{" "}
                      {r.follow_at
                        ? new Date(r.follow_at).toLocaleString("zh-CN")
                        : "—"}
                    </p>
                    <dl className="mt-2 space-y-1.5 text-sm">
                      <div>
                        <dt className="text-muted-foreground">备注</dt>
                        <dd className="mt-0.5">{r.remark?.trim() ? r.remark : "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">下次联系时间</dt>
                        <dd className="mt-0.5">
                          {r.next_follow_at
                            ? new Date(r.next_follow_at).toLocaleString("zh-CN")
                            : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">下次跟进方式</dt>
                        <dd className="mt-0.5">{followMethodLabel(r.follow_method)}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
          <TabsContent value="profile" className="mt-3">
            <p className="text-sm text-muted-foreground">暂无客户画像</p>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>分配线索</DialogTitle>
            <DialogDescription>
              为 {name} 选择归属人（企业微信 userid）
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">归属人</label>
            <select
              value={selectedOwner}
              onChange={(e) => setSelectedOwner(e.target.value)}
              className={cn(
                "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs",
                "focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
              )}
            >
              <option value="">请选择</option>
              {ASSIGNABLE_OWNER_USERIDS.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              取消
            </Button>
            <Button disabled={!selectedOwner} onClick={confirmAssign}>
              确认转交
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
