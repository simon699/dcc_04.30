"use client";

import * as React from "react";
import Link from "next/link";
import { History, MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";
import { env as wecomEnv } from "@wecom/jssdk";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUiStore } from "@/lib/store/ui-store";
import { tryOpenWecomExternalUserChat } from "@/lib/wecom-open-chat";
import { asTrimmedString, cn } from "@/lib/utils";

import { DEFAULT_LEAD_OWNER_USERID } from "@/components/leads/lead-drawer-panel";

const SHEET_WIDE =
  "flex h-full w-full max-w-full flex-col gap-0 p-0 sm:!w-[50vw] sm:!max-w-[50vw]";

const PAGE_SIZE = 10;

type ApiTaskRow = {
  row_id: string;
  task: {
    id: string;
    task_type: string;
    channel: string;
    name: string;
    status: string;
    deadline: string | null;
    creator_userid: string;
  };
  target: {
    id: number;
    target_external_userid: string | null;
    target_phone: string | null;
    target_lead_id?: string | null;
    status: string;
  };
  target_display_name?: string;
};

function todayIsoLocal(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDurationSec(sec: number | null | undefined): string {
  if (sec == null || sec <= 0 || Number.isNaN(sec)) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}分${String(s).padStart(2, "0")}秒`;
}

type PhoneFollowApiRow = {
  follow_id: number;
  follow_at: string | null;
  customer_name: string;
  phone: string;
  call_duration_seconds: number | null;
};

function taskTypeLabel(t: string): string {
  if (t === "mass_send") return "群发";
  if (t === "follow_up") return "跟进";
  return t;
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

function formatDue(v: string | null): string {
  if (!v) return "—";
  return new Date(v).toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function displayTarget(row: ApiTaskRow): string {
  const named = asTrimmedString(row.target_display_name);
  if (named && named !== "—") return named;
  const ext = asTrimmedString(row.target.target_external_userid);
  const ph = asTrimmedString(row.target.target_phone);
  if (ext) return ext;
  if (ph) return ph;
  return "—";
}

function mapTargetForDrawer(
  s: string
): "pending" | "in_progress" | "done" | "failed" {
  if (s === "done") return "done";
  if (s === "failed") return "failed";
  if (s === "in_progress") return "in_progress";
  return "pending";
}

export function TodayPendingPanel() {
  const openDrawer = useUiStore((s) => s.openDrawer);
  const [channelTab, setChannelTab] = React.useState<"phone" | "wecom">(
    "phone"
  );
  const [page, setPage] = React.useState(1);
  const [items, setItems] = React.useState<ApiTaskRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const [openingChat, setOpeningChat] = React.useState<string | null>(null);
  const [callLogOpen, setCallLogOpen] = React.useState(false);
  const [phoneFollowRows, setPhoneFollowRows] = React.useState<
    PhoneFollowApiRow[]
  >([]);
  const [phoneFollowLoading, setPhoneFollowLoading] = React.useState(false);
  const [phoneFollowErr, setPhoneFollowErr] = React.useState<string | null>(
    null
  );

  const deadlineOn = React.useMemo(() => todayIsoLocal(), []);

  const load = React.useCallback(() => {
    setLoading(true);
    setErr(null);
    const q = new URLSearchParams();
    q.set("page", String(page));
    q.set("page_size", String(PAGE_SIZE));
    q.set("deadline_on", deadlineOn);
    q.set("deadline_sort", "asc");
    q.set("target_pending_only", "true");
    q.set("channel", channelTab);
    q.set("creator_userid", DEFAULT_LEAD_OWNER_USERID);

    fetch(`/api/task-rows?${q.toString()}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json() as Promise<{
          items: ApiTaskRow[];
          total: number;
          total_pages: number;
        }>;
      })
      .then((d) => {
        setItems(d.items ?? []);
        setTotal(d.total ?? 0);
        setSelected(new Set());
      })
      .catch((e: Error) => {
        setItems([]);
        setTotal(0);
        setSelected(new Set());
        setErr(e.message || "加载失败");
      })
      .finally(() => setLoading(false));
  }, [page, deadlineOn, channelTab]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 列表拉取
    load();
  }, [load]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 切换渠道回到第一页
    setPage(1);
  }, [channelTab]);

  function loadPhoneFollows() {
    setPhoneFollowLoading(true);
    setPhoneFollowErr(null);
    const q = new URLSearchParams();
    q.set("owner_userid", DEFAULT_LEAD_OWNER_USERID);
    fetch(`/api/panel/today-phone-follows?${q.toString()}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json() as Promise<{ items: PhoneFollowApiRow[] }>;
      })
      .then((d) => setPhoneFollowRows(d.items ?? []))
      .catch((e: Error) => {
        setPhoneFollowRows([]);
        setPhoneFollowErr(e.message || "加载失败");
      })
      .finally(() => setPhoneFollowLoading(false));
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE) || 1);
  const currentPage = Math.min(page, pageCount);

  function toggleRow(rowId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }

  function toggleAllOnPage() {
    const ids = items.map((r) => r.row_id);
    if (ids.length === 0) return;
    const allSelected = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const id of ids) next.delete(id);
      } else {
        for (const id of ids) next.add(id);
      }
      return next;
    });
  }

  function startDialFromSelection() {
    const picked = items.filter((row) => selected.has(row.row_id));
    const withPhone = picked.filter((r) =>
      asTrimmedString(r.target.target_phone)
    );
    if (selected.size === 0) {
      toast.message("请先勾选任务行");
      return;
    }
    if (withPhone.length === 0) {
      toast.message("所选行暂无手机号");
      return;
    }
    const first = withPhone[0]!;
    const phone = asTrimmedString(first.target.target_phone).replace(
      /\s/g,
      ""
    );
    window.location.href = `tel:${phone}`;
  }

  const listBlock = (
    <div className="space-y-3">
      {err ? (
        <p className="text-sm text-destructive">{err}</p>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-border/70 bg-card">
        <div className="flex items-center gap-2 border-b border-border/60 bg-muted/25 px-3 py-2 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={toggleAllOnPage}
            className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded border border-input bg-background shadow-xs",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            )}
            aria-label="全选本页"
          >
            {items.length > 0 && items.every((r) => selected.has(r.row_id)) ? (
              <span className="text-[10px] text-primary">✓</span>
            ) : null}
          </button>
          <span className="font-medium text-foreground">本页全选</span>
        </div>
        <ul className="divide-y divide-border/50">
          {loading ? (
            <li className="px-3 py-8 text-center text-sm text-muted-foreground">
              加载中…
            </li>
          ) : null}
          {!loading && items.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-muted-foreground">
              暂无今日待完成任务（请确认 MySQL 与任务截止日期）
            </li>
          ) : null}
          {!loading
            ? items.map((row) => {
                const t = row.task;
                const tg = row.target;
                const ph = asTrimmedString(tg.target_phone).replace(/\s/g, "");
                const ext = asTrimmedString(tg.target_external_userid);
                const checked = selected.has(row.row_id);
                return (
                  <li key={row.row_id}>
                    <div className="flex gap-2 px-3 py-3">
                      <button
                        type="button"
                        onClick={() => toggleRow(row.row_id)}
                        className={cn(
                          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border border-input bg-background shadow-xs",
                          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                          checked &&
                            "border-primary bg-primary text-primary-foreground"
                        )}
                        aria-pressed={checked}
                        aria-label="选择该行"
                      >
                        {checked ? (
                          <span className="text-[10px]">✓</span>
                        ) : null}
                      </button>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-start gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              openDrawer({
                                type: "task",
                                id: t.id,
                                apiTargetId: String(tg.id),
                                currentCustomerName: displayTarget(row),
                                currentCustomerStatus: mapTargetForDrawer(
                                  tg.status
                                ),
                              })
                            }
                            className={cn(
                              "text-left text-sm font-medium underline decoration-primary/30 underline-offset-4",
                              "hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            )}
                          >
                            {t.name}
                          </button>
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {taskTypeLabel(t.task_type)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {displayTarget(row)}
                          <span className="mx-1.5 text-border">·</span>
                          对象 {targetStatusLabel(tg.status)}
                          <span className="mx-1.5 text-border">·</span>
                          任务 {taskStatusLabel(t.status, t.deadline)}
                          <span className="mx-1.5 text-border">·</span>
                          截止 {formatDue(t.deadline)}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {ph ? (
                            tg.target_lead_id ? (
                              <Link
                                href={`/leads/${tg.target_lead_id}/edit?entry=phone`}
                                className={cn(
                                  buttonVariants({ size: "sm" }),
                                  "h-8 gap-1"
                                )}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Phone className="size-3.5" />
                                电话
                              </Link>
                            ) : (
                              <a
                                href={`tel:${ph}`}
                                className={cn(
                                  buttonVariants({ size: "sm" }),
                                  "h-8 gap-1"
                                )}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Phone className="size-3.5" />
                                电话
                              </a>
                            )
                          ) : null}
                          {ext ? (
                            <Button
                              size="sm"
                              className="h-8 gap-1"
                              disabled={openingChat === row.row_id}
                              onClick={async () => {
                                setOpeningChat(row.row_id);
                                try {
                                  const r = await tryOpenWecomExternalUserChat({
                                    externalUserid: ext,
                                    internalUserid: t.creator_userid,
                                  });
                                  if (r.ok) return;
                                  if (wecomEnv.isWeCom) {
                                    toast.error(r.message ?? "无法打开会话");
                                    return;
                                  }
                                  openDrawer({ type: "wecom_image" });
                                } finally {
                                  setOpeningChat(null);
                                }
                              }}
                            >
                              <MessageCircle className="size-3.5" />
                              {openingChat === row.row_id ? "打开中…" : "企微"}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })
            : null}
        </ul>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          共 {total} 条 · 第 {currentPage}/{pageCount} 页
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            上一页
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= pageCount || loading}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          >
            下一页
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <Tabs
        value={channelTab}
        onValueChange={(v) => setChannelTab(v as "phone" | "wecom")}
        className="w-full"
      >
        <TabsList
          variant="line"
          className="mb-1 h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0"
        >
          <TabsTrigger value="phone" className="px-3 py-2">
            电话
          </TabsTrigger>
          <TabsTrigger value="wecom" className="px-3 py-2">
            企微
          </TabsTrigger>
        </TabsList>

        <TabsContent value="phone" className="mt-0 space-y-0">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={startDialFromSelection}
                className={cn(
                  "flex size-14 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg",
                  "transition-colors hover:bg-emerald-700",
                  "focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:outline-none"
                )}
                aria-label="按勾选拨打电话"
              >
                <Phone className="size-7 stroke-[2]" aria-hidden />
              </button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setCallLogOpen(true)}
              >
                <History className="size-4" aria-hidden />
                通话记录
              </Button>
            </div>
            {listBlock}
          </div>
        </TabsContent>

        <TabsContent value="wecom" className="mt-0">
          {listBlock}
        </TabsContent>
      </Tabs>

      <Sheet
        open={callLogOpen}
        onOpenChange={(open) => {
          setCallLogOpen(open);
          if (open) loadPhoneFollows();
        }}
      >
        <SheetContent className={SHEET_WIDE}>
          <SheetHeader className="border-b px-6 py-4 text-left">
            <SheetTitle className="flex items-center gap-2">
              <History className="size-4 text-muted-foreground" aria-hidden />
              今日电话跟进记录
            </SheetTitle>
            <SheetDescription>
              今日已保存的电话跟进（线索编辑页提交，并可填写通话时长）
            </SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-2">
            {phoneFollowErr ? (
              <p className="text-sm text-destructive">{phoneFollowErr}</p>
            ) : null}
            {phoneFollowLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                加载中…
              </p>
            ) : (
              <ScrollArea className="h-[min(420px,calc(100vh-10rem))]">
                <ul className="divide-y divide-border/60 pr-3">
                  {!phoneFollowLoading && phoneFollowRows.length === 0 ? (
                    <li className="py-8 text-center text-sm text-muted-foreground">
                      今日暂无电话跟进记录
                    </li>
                  ) : null}
                  {phoneFollowRows.map((row) => (
                    <li key={row.follow_id} className="py-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-foreground">
                          {row.customer_name}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {row.follow_at
                            ? new Date(row.follow_at).toLocaleString("zh-CN")
                            : "—"}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {row.phone}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        通话时长：{formatDurationSec(row.call_duration_seconds)}
                      </p>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
