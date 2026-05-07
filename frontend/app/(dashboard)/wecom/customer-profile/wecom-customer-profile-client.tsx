"use client";

import * as React from "react";
import { getCurExternalContact, register, env as wecomEnv } from "@wecom/jssdk";
import { MessageCircle, Phone, UserRound } from "lucide-react";
import { toast } from "sonner";

import type { CustomerProfileApi } from "@/components/customers/customer-center-drawer-panel";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUiStore } from "@/lib/store/ui-store";
import { tryOpenWecomExternalUserChat } from "@/lib/wecom-open-chat";
import {
  asTrimmedString,
  cn,
  expandWecomGetCurExternalContactError,
  formatCaughtError,
  formatHttpApiDetail,
} from "@/lib/utils";

type ExternalContactSdkState =
  | { kind: "loading" }
  | { kind: "success"; userId: string }
  | { kind: "error"; message: string };

type TimelineEvent = {
  at: string | null;
  kind: string;
  title: string;
  detail: string;
  lead_id?: string;
  task_id?: string;
  target_status?: string;
};

type LeadRow = {
  id: string;
  phone: string | null;
  customer_name: string | null;
  intent_model: string | null;
  customer_level: string | null;
  created_at: string | null;
};

type ApiTaskRow = {
  row_id: string;
  task: {
    id: string;
    name: string;
    status: string;
    deadline: string | null;
    task_type: string;
    channel: string;
    creator_userid: string;
  };
  target: {
    id: number;
    status: string;
    target_external_userid: string | null;
    target_phone: string | null;
  };
  target_display_name?: string;
};

const DEFAULT_FOLLOW_USERID = "ShiFengwei";

function parseTagLabels(raw: unknown): string[] {
  const s = asTrimmedString(raw);
  if (!s) return [];
  try {
    const v = JSON.parse(s) as unknown;
    if (Array.isArray(v)) return v.map(String).filter(Boolean);
    if (v && typeof v === "object") {
      return Object.values(v as Record<string, unknown>).map(String).filter(Boolean);
    }
  } catch {
    /* 非 JSON 时作为单行展示 */
  }
  return [s];
}

function taskStatusLabel(st: string, deadline: string | null): string {
  if (st === "done" || st === "cancelled") {
    return st === "done" ? "已完成" : "已取消";
  }
  if (deadline) {
    const d = new Date(deadline);
    if (!Number.isNaN(d.getTime()) && d.getTime() < Date.now()) {
      return "已逾期";
    }
  }
  if (st === "in_progress") return "进行中";
  return "待办";
}

function targetStatusLabel(s: string): string {
  switch (s) {
    case "pending":
      return "待处理";
    case "in_progress":
      return "进行中";
    case "done":
      return "已完成";
    case "failed":
      return "失败";
    default:
      return s;
  }
}

function mapTargetForDrawer(
  s: string
): "pending" | "in_progress" | "done" | "failed" {
  if (s === "done") return "done";
  if (s === "failed") return "failed";
  if (s === "in_progress") return "in_progress";
  return "pending";
}

function targetLabel(row: ApiTaskRow): string {
  const n = asTrimmedString(row.target_display_name);
  if (n && n !== "—") return n;
  const e = asTrimmedString(row.target.target_external_userid);
  const ph = asTrimmedString(row.target.target_phone);
  if (e) return e;
  if (ph) return ph;
  return "—";
}

export function WecomCustomerProfileClient({
  leadId: _leadId,
  autoOpenFollow: _autoOpenFollow,
  followUserid,
}: {
  /** 保留兼容（侧边栏入口可能仍传 leadId） */
  leadId?: string;
  autoOpenFollow?: boolean;
  /** 查询 profile 时使用的跟进成员，默认 ShiFengwei */
  followUserid?: string;
}) {
  void _leadId;
  void _autoOpenFollow;
  const corpId = process.env.NEXT_PUBLIC_WECOM_CORP_ID ?? "";
  const agentId = process.env.NEXT_PUBLIC_WECOM_AGENT_ID ?? "";
  const fu = asTrimmedString(followUserid ?? DEFAULT_FOLLOW_USERID);

  const openDrawer = useUiStore((s) => s.openDrawer);
  const [openingWecom, setOpeningWecom] = React.useState(false);

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
  const wecomClientHint = !wecomEnv.isWeCom;

  const [profile, setProfile] = React.useState<CustomerProfileApi | null>(null);
  const [profileErr, setProfileErr] = React.useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = React.useState(false);

  const [timeline, setTimeline] = React.useState<TimelineEvent[]>([]);
  const [loadingTimeline, setLoadingTimeline] = React.useState(false);
  const [leads, setLeads] = React.useState<LeadRow[]>([]);
  const [loadingLeads, setLoadingLeads] = React.useState(false);
  const [tasks, setTasks] = React.useState<ApiTaskRow[]>([]);
  const [loadingTasks, setLoadingTasks] = React.useState(false);

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
            const r = await fetch(
              `/api/wecom/jssdk/corp-signature?url=${encodeURIComponent(url)}`,
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
              `/api/wecom/jssdk/agent-signature?url=${encodeURIComponent(url)}`,
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
        const res = await getCurExternalContact();
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
        setExternalContact({
          kind: "error",
          message: formatCaughtError(e),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [corpId, agentId]);

  const extUserId =
    externalContact.kind === "success" ? asTrimmedString(externalContact.userId) : "";

  const loadProfile = React.useCallback(async () => {
    if (!extUserId) return;
    setLoadingProfile(true);
    setProfileErr(null);
    try {
      const q = new URLSearchParams({
        follow_userid: fu,
        external_userid: extUserId,
      });
      const r = await fetch(`/api/customers/profile?${q}`);
      let json: unknown;
      try {
        json = await r.json();
      } catch {
        throw new Error(`HTTP ${r.status}`);
      }
      if (!r.ok) throw new Error(formatHttpApiDetail(json));
      setProfile(json as CustomerProfileApi);
    } catch (e) {
      setProfile(null);
      setProfileErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingProfile(false);
    }
  }, [extUserId, fu]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- profile 请求
    void loadProfile();
  }, [loadProfile]);

  const loadTimeline = React.useCallback(async () => {
    if (!extUserId) return;
    setLoadingTimeline(true);
    try {
      const q = new URLSearchParams({ external_userid: extUserId, limit: "80" });
      const r = await fetch(`/api/customers/timeline?${q}`);
      const json = (await r.json()) as { items?: TimelineEvent[] };
      if (!r.ok) throw new Error(formatHttpApiDetail(json));
      setTimeline(json.items ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      setTimeline([]);
    } finally {
      setLoadingTimeline(false);
    }
  }, [extUserId]);

  const loadLeads = React.useCallback(async () => {
    if (!extUserId) return;
    setLoadingLeads(true);
    try {
      const q = new URLSearchParams({
        external_userid: extUserId,
        page: "1",
        page_size: "50",
      });
      const r = await fetch(`/api/leads/by-external?${q}`);
      const json = (await r.json()) as { items?: LeadRow[] };
      if (!r.ok) throw new Error(formatHttpApiDetail(json));
      setLeads(json.items ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      setLeads([]);
    } finally {
      setLoadingLeads(false);
    }
  }, [extUserId]);

  const loadTasks = React.useCallback(async () => {
    if (!extUserId) return;
    setLoadingTasks(true);
    try {
      const q = new URLSearchParams({
        page: "1",
        page_size: "50",
        target_external_userid: extUserId,
      });
      const r = await fetch(`/api/task-rows?${q}`);
      const json = (await r.json()) as { items?: ApiTaskRow[] };
      if (!r.ok) throw new Error(formatHttpApiDetail(json));
      setTasks(json.items ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      setTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  }, [extUserId]);

  React.useEffect(() => {
    if (!extUserId) return;
    /* eslint-disable react-hooks/set-state-in-effect -- 并行拉取 tab 数据 */
    void loadTimeline();
    void loadLeads();
    void loadTasks();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [extUserId, loadTimeline, loadLeads, loadTasks]);

  const displayName = profile
    ? asTrimmedString(profile.display_name) || asTrimmedString(profile.external_userid)
    : extUserId || "—";
  const phoneDisplay = asTrimmedString(profile?.phone);
  const tagLabels = React.useMemo(() => {
    const a = parseTagLabels(profile?.tags_json);
    const b = parseTagLabels(profile?.tag_id_json);
    return [...new Set([...a, ...b])];
  }, [profile?.tags_json, profile?.tag_id_json]);

  return (
    <div className="mx-auto w-full max-w-md space-y-4 pb-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">外部联系人</CardTitle>
          <p className="text-sm font-normal text-muted-foreground">
            <code className="rounded bg-muted px-1 py-0.5 text-xs">getCurExternalContact</code>
            返回当前会话外部联系人 ID；须在企业微信内从支持的入口打开。
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {wecomClientHint ? (
            <p className="text-sm text-amber-600 dark:text-amber-500">
              当前不在企业微信内置浏览器中，该接口通常无法返回客户 ID。
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

      {externalContact.kind === "success" ? (
        <Card>
          <CardContent className="pt-5">
            {loadingProfile && !profile ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : profileErr && !profile ? (
              <p className="text-sm text-destructive whitespace-pre-wrap">{profileErr}</p>
            ) : profile ? (
              <>
                <div className="flex items-start gap-3">
                  {profile.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.avatar}
                      alt=""
                      className="size-12 shrink-0 rounded-full bg-muted object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <UserRound className="size-6" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-muted-foreground">客户</p>
                    <h1 className="truncate text-xl font-semibold">{displayName}</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      手机：{phoneDisplay || "无"}
                    </p>
                    {profile.corp_name ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{profile.corp_name}</p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {phoneDisplay ? (
                    <a
                      href={`tel:${phoneDisplay.replace(/\s/g, "")}`}
                      className={cn(buttonVariants(), "gap-1")}
                    >
                      <Phone className="size-4" />
                      电话
                    </a>
                  ) : (
                    <Button disabled variant="outline" className="gap-1">
                      <Phone className="size-4" />
                      无手机号
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    className="gap-1"
                    disabled={openingWecom || !asTrimmedString(profile.external_userid)}
                    onClick={async () => {
                      const eid = asTrimmedString(profile.external_userid);
                      if (!eid) return;
                      setOpeningWecom(true);
                      try {
                        const r = await tryOpenWecomExternalUserChat({
                          externalUserid: eid,
                          internalUserid: profile.follow_userid,
                        });
                        if (r.ok) return;
                        if (wecomEnv.isWeCom) {
                          toast.error(r.message ?? "无法打开会话");
                          return;
                        }
                        openDrawer({ type: "wecom_image" });
                      } finally {
                        setOpeningWecom(false);
                      }
                    }}
                  >
                    <MessageCircle className="size-4" />
                    {openingWecom ? "打开中…" : "会话"}
                  </Button>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {externalContact.kind === "success" && profile ? (
        <Tabs defaultValue="timeline" className="w-full">
          <TabsList variant="line" className="w-full flex-wrap justify-start bg-transparent p-0">
            <TabsTrigger value="timeline" className="px-3 py-2">
              客户轨迹
            </TabsTrigger>
            <TabsTrigger value="leads" className="px-3 py-2">
              线索
            </TabsTrigger>
            <TabsTrigger value="tasks" className="px-3 py-2">
              任务
            </TabsTrigger>
            <TabsTrigger value="tags" className="px-3 py-2">
              标签
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="mt-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">轨迹</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingTimeline ? (
                  <p className="text-sm text-muted-foreground">加载中…</p>
                ) : timeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground">暂无记录</p>
                ) : (
                  <ul className="space-y-3">
                    {timeline.map((ev, i) => (
                      <li key={`${ev.at}-${i}`} className="relative pl-5">
                        <span className="absolute left-0 top-1.5 size-2 rounded-full bg-primary" />
                        <p className="text-xs text-muted-foreground">
                          {ev.at
                            ? new Date(ev.at).toLocaleString("zh-CN")
                            : "—"}
                          {ev.kind === "lead_follow" ? (
                            <Badge variant="outline" className="ml-2 font-normal">
                              线索
                            </Badge>
                          ) : null}
                          {ev.kind === "task_target" ? (
                            <Badge variant="secondary" className="ml-2 font-normal">
                              任务
                            </Badge>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-sm font-medium">{ev.title}</p>
                        {ev.detail ? (
                          <p className="mt-1 text-sm text-muted-foreground">{ev.detail}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leads" className="mt-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">线索</CardTitle>
              </CardHeader>
              <CardContent className="p-0 sm:p-2">
                {loadingLeads ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">加载中…</p>
                ) : leads.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">暂无线索</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>客户</TableHead>
                        <TableHead className="hidden sm:table-cell">意向</TableHead>
                        <TableHead className="w-[72px]"> </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leads.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell>
                            <div className="font-medium">
                              {asTrimmedString(l.customer_name) || "—"}
                            </div>
                            <div className="text-xs text-muted-foreground">{l.phone ?? "—"}</div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {l.intent_model ?? "—"}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="link"
                              className="h-auto px-0"
                              onClick={() => openDrawer({ type: "lead", id: l.id })}
                            >
                              详情
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks" className="mt-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">任务</CardTitle>
              </CardHeader>
              <CardContent className="p-0 sm:p-2">
                {loadingTasks ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">加载中…</p>
                ) : tasks.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">暂无任务对象</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>任务</TableHead>
                        <TableHead className="hidden sm:table-cell">状态</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tasks.map((row) => {
                        const t = row.task;
                        const tg = row.target;
                        return (
                          <TableRow key={row.row_id}>
                            <TableCell>
                              <button
                                type="button"
                                className="text-left font-medium text-primary underline-offset-4 hover:underline"
                                onClick={() =>
                                  openDrawer({
                                    type: "task",
                                    id: t.id,
                                    apiTargetId: String(tg.id),
                                    currentCustomerName: targetLabel(row),
                                    currentCustomerStatus: mapTargetForDrawer(tg.status),
                                  })
                                }
                              >
                                {t.name}
                              </button>
                              <div className="text-xs text-muted-foreground">
                                {taskStatusLabel(t.status, t.deadline)} ·{" "}
                                {targetStatusLabel(tg.status)}
                              </div>
                            </TableCell>
                            <TableCell className="hidden text-sm sm:table-cell">
                              {taskStatusLabel(t.status, t.deadline)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tags" className="mt-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">标签</CardTitle>
              </CardHeader>
              <CardContent>
                {tagLabels.length === 0 ? (
                  <p className="text-sm text-muted-foreground">暂无标签</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {tagLabels.map((t) => (
                      <Badge key={t} variant="secondary" className="font-normal">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}
