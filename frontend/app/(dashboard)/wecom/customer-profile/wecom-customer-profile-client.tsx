"use client";

import * as React from "react";
import { getCurExternalContact, register } from "@wecom/jssdk";
import { Phone, UserRound } from "lucide-react";
import { toast } from "sonner";

import type { CustomerProfileApi } from "@/components/customers/customer-center-drawer-panel";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ApiLeadDetail } from "@/components/leads/lead-drawer-panel";
import { useUiStore } from "@/lib/store/ui-store";
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
  remark?: string;
  next_follow_at?: string | null;
  follow_method?: string | null;
  task_name?: string | null;
  task_deadline?: string | null;
  channel?: string | null;
  task_type?: string | null;
  target_remark?: string | null;
};

type LeadRow = {
  id: string;
  phone: string | null;
  customer_name: string | null;
  external_userid?: string | null;
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

function targetLabel(row: ApiTaskRow): string {
  const n = asTrimmedString(row.target_display_name);
  if (n && n !== "—") return n;
  const e = asTrimmedString(row.target.target_external_userid);
  const ph = asTrimmedString(row.target.target_phone);
  if (e) return e;
  if (ph) return ph;
  return "—";
}

function defaultTomorrowMorning(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}T10:00`;
}

function taskTypeShort(t: string): string {
  if (t === "mass_send") return "群发";
  if (t === "follow_up") return "跟进";
  return t;
}

function channelShort(ch: string): string {
  if (ch === "phone") return "电话";
  if (ch === "wecom") return "企微";
  return ch;
}

function followMethodCn(m?: string | null): string {
  const x = (m ?? "").trim().toLowerCase();
  if (x === "phone") return "电话";
  if (x === "wecom") return "微信";
  return (m ?? "").trim() || "—";
}

function timelineKindBadge(kind: string) {
  if (kind === "lead_follow") {
    return (
      <Badge variant="outline" className="ml-2 font-normal">
        线索跟进
      </Badge>
    );
  }
  if (kind === "task_created") {
    return (
      <Badge variant="secondary" className="ml-2 font-normal">
        创建任务
      </Badge>
    );
  }
  if (kind === "task_completed") {
    return (
      <Badge className="ml-2 border-emerald-600/40 bg-emerald-600/10 font-normal text-emerald-800 dark:text-emerald-200">
        任务完成
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="ml-2 font-normal">
      {kind}
    </Badge>
  );
}

function resolveLeadIdForTask(row: ApiTaskRow, list: LeadRow[]): string | null {
  const ext = asTrimmedString(row.target.target_external_userid);
  const phRaw = asTrimmedString(row.target.target_phone).replace(/\s/g, "");
  const digitEq = (a: string, b: string) => {
    const da = a.replace(/\D/g, "");
    const db = b.replace(/\D/g, "");
    return da.length >= 7 && da === db;
  };
  if (ext) {
    const hit = list.find((l) => asTrimmedString(l.external_userid) === ext);
    if (hit) return hit.id;
  }
  if (phRaw) {
    const hit = list.find((l) => {
      const lp = asTrimmedString(l.phone).replace(/\s/g, "");
      return digitEq(lp, phRaw);
    });
    if (hit) return hit.id;
  }
  return list[0]?.id ?? null;
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

  const [taskSheetRow, setTaskSheetRow] = React.useState<ApiTaskRow | null>(null);
  const [taskSheetStep, setTaskSheetStep] = React.useState<"detail" | "follow">(
    "detail"
  );
  const [followNextAt, setFollowNextAt] = React.useState("");
  const [followRemark, setFollowRemark] = React.useState("");
  const [followMethod, setFollowMethod] = React.useState<"phone" | "wecom">(
    "wecom"
  );
  const [followPhoneExtra, setFollowPhoneExtra] = React.useState("");
  const [followCallSec, setFollowCallSec] = React.useState("");
  const [followSubmitting, setFollowSubmitting] = React.useState(false);

  const [taskListScope, setTaskListScope] = React.useState<"open" | "all">(
    "open"
  );
  const [leadDetail, setLeadDetail] = React.useState<ApiLeadDetail | null>(null);
  const [loadingLeadDetail, setLoadingLeadDetail] = React.useState(false);

  const openTaskSheet = React.useCallback((row: ApiTaskRow) => {
    setTaskSheetRow(row);
    setTaskSheetStep("detail");
    setFollowRemark("");
    setFollowCallSec("");
    setFollowPhoneExtra("");
    setFollowNextAt(defaultTomorrowMorning());
    const t = row.task;
    setFollowMethod(t.channel === "phone" ? "phone" : "wecom");
  }, []);

  const completeTaskTargetSimple = React.useCallback(
    async (row: ApiTaskRow) => {
      const t = row.task;
      const tg = row.target;
      if (t.status === "done" || tg.status === "done") {
        toast.message("任务已完成");
        return;
      }
      try {
        const r = await fetch(
          `/api/tasks/${encodeURIComponent(t.id)}/targets/${encodeURIComponent(
            String(tg.id)
          )}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: "done",
              completed_at: new Date().toISOString(),
            }),
          }
        );
        const json: unknown = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(formatHttpApiDetail(json));
        toast.success("已标记完成");
        setTaskSheetRow(null);
        void loadTasks();
        void loadTimeline();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      }
    },
    [loadTasks, loadTimeline]
  );

  const submitFollowComplete = React.useCallback(async () => {
    if (!taskSheetRow) return;
    const leadId = resolveLeadIdForTask(taskSheetRow, leads);
    if (!leadId) {
      toast.error("未匹配到线索，无法提交跟进");
      return;
    }
    const leadRow = leads.find((l) => l.id === leadId);
    const storedPhone = asTrimmedString(leadRow?.phone);
    const profilePhone = asTrimmedString(profile?.phone);
    const effectivePhone =
      storedPhone || followPhoneExtra.trim() || profilePhone;
    if (!followNextAt.trim()) {
      toast.error("请填写下次联系时间");
      return;
    }
    if (followMethod === "phone" && !effectivePhone) {
      toast.error("电话跟进请先填写手机号（线索或下方补充）");
      return;
    }
    let callDurationSeconds: number | undefined;
    if (followMethod === "phone" && followCallSec.trim()) {
      const n = parseInt(followCallSec.trim(), 10);
      if (Number.isNaN(n) || n < 0) {
        toast.error("通话时长须为非负整数（秒）");
        return;
      }
      callDurationSeconds = n;
    }
    const extOk =
      Boolean(asTrimmedString(profile?.external_userid)) ||
      Boolean(asTrimmedString(leadRow?.external_userid));
    const phoneOk = Boolean(effectivePhone);
    if (!phoneOk && !extOk) {
      toast.error("缺少手机号与企微身份，无法生成任务");
      return;
    }
    setFollowSubmitting(true);
    try {
      const tid = parseInt(taskSheetRow.task.id, 10);
      const body: Record<string, unknown> = {
        intent_model: leadRow?.intent_model ?? null,
        customer_level: leadRow?.customer_level ?? null,
        remark: followRemark.trim() || null,
        invite_store_at: null,
        next_follow_at: followNextAt.trim(),
        next_follow_method: followMethod,
      };
      if (!Number.isNaN(tid)) {
        body.completed_task_id = tid;
      }
      if (!storedPhone && followPhoneExtra.trim()) {
        body.phone = followPhoneExtra.trim();
      }
      if (callDurationSeconds !== undefined) {
        body.call_duration_seconds = callDurationSeconds;
      }
      const r = await fetch(
        `/api/leads/${encodeURIComponent(leadId)}/complete-follow`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const json: unknown = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(formatHttpApiDetail(json));
      toast.success("跟进已保存，上一任务已关闭并生成新任务");
      setTaskSheetRow(null);
      setTaskSheetStep("detail");
      void loadTasks();
      void loadTimeline();
      void loadLeads();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setFollowSubmitting(false);
    }
  }, [
    taskSheetRow,
    leads,
    profile,
    followNextAt,
    followRemark,
    followMethod,
    followPhoneExtra,
    followCallSec,
    loadTasks,
    loadTimeline,
    loadLeads,
  ]);

  React.useEffect(() => {
    if (!extUserId) return;
    /* eslint-disable react-hooks/set-state-in-effect -- 并行拉取 tab 数据 */
    void loadTimeline();
    void loadLeads();
    void loadTasks();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [extUserId, loadTimeline, loadLeads, loadTasks]);

  React.useEffect(() => {
    const first = leads[0];
    if (!first?.id) {
      setLeadDetail(null);
      return;
    }
    let cancelled = false;
    setLoadingLeadDetail(true);
    fetch(`/api/leads/${encodeURIComponent(first.id)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json() as Promise<ApiLeadDetail>;
      })
      .then((d) => {
        if (!cancelled) setLeadDetail(d);
      })
      .catch(() => {
        if (!cancelled) setLeadDetail(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingLeadDetail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leads]);

  const scopedTasks = React.useMemo(() => {
    if (taskListScope === "all") return tasks;
    return tasks.filter((row) => {
      const t = row.task;
      const tg = row.target;
      return (
        t.status !== "done" &&
        t.status !== "cancelled" &&
        tg.status !== "done" &&
        tg.status !== "failed"
      );
    });
  }, [tasks, taskListScope]);

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
      {externalContact.kind === "loading" ? (
        <Card>
          <CardContent className="py-8">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-3/4" />
          </CardContent>
        </Card>
      ) : null}

      {externalContact.kind === "error" ? (
        <Card>
          <CardContent className="py-6">
            <p className="whitespace-pre-line text-sm text-destructive leading-relaxed">
              {externalContact.message}
            </p>
          </CardContent>
        </Card>
      ) : null}

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
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {externalContact.kind === "success" && profile ? (
        <Tabs defaultValue="tasks" className="w-full">
          <TabsList variant="line" className="w-full flex-wrap justify-start bg-transparent p-0">
            <TabsTrigger value="tasks" className="px-3 py-2">
              任务
            </TabsTrigger>
            <TabsTrigger value="timeline" className="px-3 py-2">
              客户轨迹
            </TabsTrigger>
            <TabsTrigger value="leads" className="px-3 py-2">
              线索
            </TabsTrigger>
            <TabsTrigger value="tags" className="px-3 py-2">
              标签
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="mt-3">
            <Card>
              <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base">任务</CardTitle>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={taskListScope === "open" ? "default" : "outline"}
                    onClick={() => setTaskListScope("open")}
                  >
                    未完成
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={taskListScope === "all" ? "default" : "outline"}
                    onClick={() => setTaskListScope("all")}
                  >
                    全部
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 sm:p-2">
                {loadingTasks ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">加载中…</p>
                ) : tasks.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">暂无任务对象</p>
                ) : scopedTasks.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">
                    暂无未完成任务
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>任务名称</TableHead>
                        <TableHead className="hidden sm:table-cell whitespace-nowrap">
                          截止时间
                        </TableHead>
                        <TableHead className="hidden sm:table-cell">状态</TableHead>
                        <TableHead className="hidden sm:table-cell">跟进方式</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scopedTasks.map((row) => {
                        const t = row.task;
                        const tg = row.target;
                        const statusLine = `${taskStatusLabel(t.status, t.deadline)} · ${targetStatusLabel(tg.status)}`;
                        return (
                          <TableRow key={row.row_id}>
                            <TableCell>
                              <button
                                type="button"
                                className="text-left font-medium text-primary underline-offset-4 hover:underline"
                                onClick={() => openTaskSheet(row)}
                              >
                                {t.name}
                              </button>
                              <div className="mt-1 text-xs text-muted-foreground sm:hidden">
                                {t.deadline
                                  ? new Date(t.deadline).toLocaleString("zh-CN")
                                  : "—"}{" "}
                                · {channelShort(t.channel)} · {statusLine}
                              </div>
                            </TableCell>
                            <TableCell className="hidden whitespace-nowrap text-sm sm:table-cell">
                              {t.deadline
                                ? new Date(t.deadline).toLocaleString("zh-CN")
                                : "—"}
                            </TableCell>
                            <TableCell className="hidden text-sm sm:table-cell">
                              {statusLine}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              {channelShort(t.channel)}
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
                  <ul className="space-y-4">
                    {timeline.map((ev, i) => (
                      <li
                        key={`${ev.kind}-${ev.at}-${ev.task_id ?? ev.lead_id ?? ""}-${i}`}
                        className="relative border-l-2 border-primary/25 pl-4"
                      >
                        <p className="text-xs text-muted-foreground">
                          {ev.at
                            ? new Date(ev.at).toLocaleString("zh-CN")
                            : "—"}
                          {timelineKindBadge(ev.kind)}
                        </p>
                        <p className="mt-1 text-sm font-medium">{ev.title}</p>
                        {ev.kind === "lead_follow" ? (
                          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                            {ev.next_follow_at ? (
                              <p>
                                <span className="text-foreground/80">下次联系：</span>
                                {new Date(ev.next_follow_at).toLocaleString("zh-CN")}
                              </p>
                            ) : null}
                            <p>
                              <span className="text-foreground/80">跟进方式：</span>
                              {followMethodCn(ev.follow_method)}
                            </p>
                            {(ev.remark ?? ev.detail)?.trim() ? (
                              <p className="text-sm text-foreground">
                                <span className="text-muted-foreground">备注：</span>
                                {(ev.remark ?? ev.detail ?? "").trim()}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <>
                            {ev.detail?.trim() ? (
                              <p className="mt-1 text-sm text-muted-foreground">
                                {ev.detail}
                              </p>
                            ) : null}
                            {ev.kind === "task_created" && ev.task_deadline ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                截止：{new Date(ev.task_deadline).toLocaleString("zh-CN")}
                              </p>
                            ) : null}
                            {ev.kind === "task_completed" &&
                            (ev.target_remark ?? "").trim() ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                备注：{(ev.target_remark ?? "").trim()}
                              </p>
                            ) : null}
                          </>
                        )}
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
              <CardContent className="space-y-3 px-4 py-2 text-sm">
                {loadingLeads ? (
                  <p className="text-muted-foreground">加载中…</p>
                ) : leads.length === 0 ? (
                  <p className="text-muted-foreground">暂无线索</p>
                ) : loadingLeadDetail && !leadDetail ? (
                  <p className="text-muted-foreground">加载详情…</p>
                ) : leadDetail ? (
                  <div className="space-y-4">
                    <dl className="space-y-3">
                      <div>
                        <dt className="text-muted-foreground">客户姓名</dt>
                        <dd className="font-medium">
                          {(leadDetail.customer_name ?? "").trim() || "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">手机</dt>
                        <dd className="font-mono">{leadDetail.phone ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">意向车型</dt>
                        <dd>{leadDetail.intent_model ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">客户等级</dt>
                        <dd>{leadDetail.customer_level ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">归属人</dt>
                        <dd>{leadDetail.owner_userid ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">下次跟进（参考）</dt>
                        <dd>
                          {leadDetail.next_follow_up_at
                            ? new Date(leadDetail.next_follow_up_at).toLocaleString(
                                "zh-CN"
                              )
                            : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">最近备注</dt>
                        <dd className="whitespace-pre-wrap">
                          {(leadDetail.latest_remark ?? "").trim() || "—"}
                        </dd>
                      </div>
                    </dl>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() =>
                        openDrawer({ type: "lead", id: leadDetail.id })
                      }
                    >
                      侧边栏查看完整跟进记录
                    </Button>
                  </div>
                ) : (
                  <p className="text-muted-foreground">无法加载线索详情</p>
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

      <Sheet
        open={taskSheetRow !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTaskSheetRow(null);
            setTaskSheetStep("detail");
          }
        }}
      >
        <SheetContent
          side="bottom"
          className="flex max-h-[70vh] flex-col gap-0 overflow-hidden rounded-t-2xl border-x-0 p-0"
        >
          {taskSheetRow ? (
            <>
              <SheetHeader className="shrink-0 border-b px-4 pb-3 pt-2">
                <SheetTitle className="pr-10 text-left text-base">
                  {taskSheetStep === "detail"
                    ? taskSheetRow.task.name
                    : "跟进完成"}
                </SheetTitle>
                <SheetDescription className="text-left">
                  {taskSheetStep === "detail"
                    ? `${channelShort(taskSheetRow.task.channel)} · ${taskTypeShort(taskSheetRow.task.task_type)} · ${targetLabel(taskSheetRow)}`
                    : "填写下次联系时间与备注，将关闭本条跟进任务并生成新任务"}
                </SheetDescription>
              </SheetHeader>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                {taskSheetStep === "detail" ? (
                  (() => {
                    const t = taskSheetRow.task;
                    const tg = taskSheetRow.target;
                    const canAct =
                      t.status !== "done" &&
                      t.status !== "cancelled" &&
                      tg.status !== "done" &&
                      tg.status !== "failed";
                    return (
                      <div className="space-y-4 text-sm">
                        <div className="space-y-1 rounded-lg border border-border/60 bg-muted/30 p-3">
                          <p>
                            <span className="text-muted-foreground">截止时间：</span>
                            {t.deadline
                              ? new Date(t.deadline).toLocaleString("zh-CN")
                              : "—"}
                          </p>
                          <p>
                            <span className="text-muted-foreground">任务状态：</span>
                            {taskStatusLabel(t.status, t.deadline)}
                          </p>
                          <p>
                            <span className="text-muted-foreground">对象状态：</span>
                            {targetStatusLabel(tg.status)}
                          </p>
                        </div>
                        {!canAct ? (
                          <p className="text-center text-muted-foreground">当前任务已结束</p>
                        ) : t.task_type === "follow_up" ? (
                          <Button
                            type="button"
                            className="w-full"
                            size="lg"
                            onClick={() => setTaskSheetStep("follow")}
                          >
                            完成任务
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            className="w-full"
                            size="lg"
                            onClick={() => void completeTaskTargetSimple(taskSheetRow)}
                          >
                            完成任务
                          </Button>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <div className="space-y-4">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="-ml-2 text-muted-foreground"
                      onClick={() => setTaskSheetStep("detail")}
                    >
                      ← 返回详情
                    </Button>
                    {(() => {
                      const lid = resolveLeadIdForTask(taskSheetRow, leads);
                      const lr = leads.find((l) => l.id === lid);
                      const storedLeadPhone = asTrimmedString(lr?.phone);
                      const needPhoneExtra =
                        !storedLeadPhone && !asTrimmedString(profile?.phone);
                      const effPhone =
                        storedLeadPhone ||
                        followPhoneExtra.trim() ||
                        asTrimmedString(profile?.phone);
                      const canPickPhone = Boolean(effPhone);
                      return (
                        <>
                          {needPhoneExtra ? (
                            <div className="space-y-2">
                              <Label htmlFor="h5-follow-phone">手机号（无主档时填写）</Label>
                              <Input
                                id="h5-follow-phone"
                                value={followPhoneExtra}
                                onChange={(e) => setFollowPhoneExtra(e.target.value)}
                                placeholder="用于电话跟进与生成任务"
                                autoComplete="tel"
                              />
                            </div>
                          ) : null}

                          <div className="space-y-2">
                            <Label htmlFor="h5-follow-next">
                              下次联系时间 <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              id="h5-follow-next"
                              type="datetime-local"
                              value={followNextAt}
                              onChange={(e) => setFollowNextAt(e.target.value)}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>跟进方式</Label>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant={followMethod === "phone" ? "default" : "outline"}
                                disabled={!canPickPhone}
                                title={
                                  !canPickPhone ? "请先填写可用手机号" : undefined
                                }
                                onClick={() => setFollowMethod("phone")}
                              >
                                电话
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={followMethod === "wecom" ? "default" : "outline"}
                                onClick={() => setFollowMethod("wecom")}
                              >
                                微信
                              </Button>
                            </div>
                          </div>

                          {followMethod === "phone" ? (
                            <div className="space-y-2">
                              <Label htmlFor="h5-follow-call">通话时长（秒，选填）</Label>
                              <Input
                                id="h5-follow-call"
                                inputMode="numeric"
                                value={followCallSec}
                                onChange={(e) =>
                                  setFollowCallSec(e.target.value.replace(/\D/g, ""))
                                }
                                placeholder="例如 180"
                              />
                            </div>
                          ) : null}

                          <div className="space-y-2">
                            <Label htmlFor="h5-follow-remark">跟进备注</Label>
                            <Textarea
                              id="h5-follow-remark"
                              value={followRemark}
                              onChange={(e) => setFollowRemark(e.target.value)}
                              rows={4}
                              placeholder="本次跟进说明"
                            />
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>

              {taskSheetStep === "follow" ? (
                <SheetFooter className="shrink-0 border-t bg-background px-4 py-3">
                  <Button
                    type="button"
                    className="w-full"
                    size="lg"
                    disabled={followSubmitting}
                    onClick={() => void submitFollowComplete()}
                  >
                    {followSubmitting ? "提交中…" : "提交并完成"}
                  </Button>
                </SheetFooter>
              ) : null}
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
