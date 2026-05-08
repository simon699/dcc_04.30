"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Megaphone, MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";
import { env as wecomEnv } from "@wecom/jssdk";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUiStore } from "@/lib/store/ui-store";
import {
  isWeComMacMassSendLimited,
  shareMassSendTextToExternalContacts,
} from "@/lib/wecom-mass-send";
import { tryOpenWecomExternalUserChat } from "@/lib/wecom-open-chat";
import { asTrimmedString, cn } from "@/lib/utils";

export type ChannelTab = "all" | "phone" | "wecom";

export type TaskTableProps = {
  /** 与顶部「全部 / 电话 / 企微」Tab 同步（由页面传入以便创建任务默认触达方式） */
  channelTab: ChannelTab;
  onChannelTabChange: (tab: ChannelTab) => void;
  /** 递增后触发列表重新拉取（如创建任务成功） */
  refreshNonce?: number;
};

type ApiTaskRow = {
  row_id: string;
  task: {
    id: string;
    task_type: string;
    channel: string;
    name: string;
    status: string;
    deadline: string | null;
    start_at: string | null;
    completed_at: string | null;
    creator_userid: string;
    mass_content?: string | null;
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

const PAGE_SIZE = 10;

function taskTypeLabel(t: string): string {
  if (t === "mass_send") return "群发";
  if (t === "follow_up") return "跟进";
  return t;
}

function channelLabel(ch: string): string {
  if (ch === "phone") return "电话";
  if (ch === "wecom") return "企微";
  return ch;
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

export function TaskTable({
  channelTab,
  onChannelTabChange,
  refreshNonce = 0,
}: TaskTableProps) {
  const router = useRouter();
  const openDrawer = useUiStore((s) => s.openDrawer);
  const [openingChat, setOpeningChat] = React.useState<string | null>(null);
  const [massSendRow, setMassSendRow] = React.useState<string | null>(null);

  const tab = channelTab;
  const [keyword, setKeyword] = React.useState("");
  const [taskStatus, setTaskStatus] = React.useState("");
  const [rowStatus, setRowStatus] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [items, setItems] = React.useState<ApiTaskRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    setErr(null);
    const q = new URLSearchParams();
    q.set("page", String(page));
    q.set("page_size", String(PAGE_SIZE));
    if (keyword.trim()) q.set("keyword", keyword.trim());
    if (taskStatus.trim()) q.set("task_status", taskStatus.trim());
    if (rowStatus.trim()) q.set("row_status", rowStatus.trim());
    if (tab === "phone") q.set("channel", "phone");
    if (tab === "wecom") q.set("channel", "wecom");

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
      })
      .catch((e: Error) => {
        setItems([]);
        setTotal(0);
        setErr(e.message || "加载失败");
      })
      .finally(() => setLoading(false));
  }, [page, keyword, taskStatus, rowStatus, tab]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 列表拉取
    load();
  }, [load, refreshNonce]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 筛选变更回到第一页
    setPage(1);
  }, [keyword, taskStatus, rowStatus, tab]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE) || 1);
  const currentPage = Math.min(page, pageCount);

  function mapTargetForDrawer(
    s: string
  ): "pending" | "in_progress" | "done" | "failed" {
    if (s === "done") return "done";
    if (s === "failed") return "failed";
    if (s === "in_progress") return "in_progress";
    return "pending";
  }

  return (
    <div className="space-y-4">
      <Tabs
        value={tab}
        onValueChange={(v) => onChannelTabChange(v as ChannelTab)}
        className="w-full"
      >
        <TabsList className="h-9 w-full flex-wrap justify-start gap-1 bg-transparent p-0">
          <TabsTrigger value="all" className="data-[state=active]:bg-background">
            全部
          </TabsTrigger>
          <TabsTrigger value="phone" className="data-[state=active]:bg-background">
            电话
          </TabsTrigger>
          <TabsTrigger value="wecom" className="data-[state=active]:bg-background">
            企微
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-2 sm:grid-cols-4">
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="任务名称"
        />
        <select
          value={taskStatus}
          onChange={(e) => setTaskStatus(e.target.value)}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs",
            "focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
          )}
          aria-label="任务状态"
        >
          <option value="">任务状态（全部）</option>
          <option value="pending">待办</option>
          <option value="in_progress">进行中</option>
          <option value="done">已完成</option>
          <option value="cancelled">已取消</option>
        </select>
        <select
          value={rowStatus}
          onChange={(e) => setRowStatus(e.target.value)}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs",
            "focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
          )}
          aria-label="对象状态"
        >
          <option value="">对象状态（全部）</option>
          <option value="pending">待处理</option>
          <option value="in_progress">进行中</option>
          <option value="done">已完成</option>
          <option value="failed">失败</option>
        </select>
      </div>

      {err ? <p className="text-sm text-destructive">{err}</p> : null}

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[180px]">任务</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>触达</TableHead>
              <TableHead>当前对象</TableHead>
              <TableHead>对象状态</TableHead>
              <TableHead>任务状态</TableHead>
              <TableHead>截止时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  加载中…
                </TableCell>
              </TableRow>
            ) : null}
            {!loading && items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  暂无任务数据（请确认已执行 MySQL 建表并配置 MYSQL_URL）
                </TableCell>
              </TableRow>
            ) : null}
            {!loading
              ? items.map((row) => {
                  const t = row.task;
                  const tg = row.target;
                  const phone =
                    row.target.target_phone?.replace(/\s/g, "") ?? "";
                  return (
                    <TableRow key={row.row_id}>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() =>
                            openDrawer({
                              type: "task",
                              id: t.id,
                              apiTargetId: String(tg.id),
                              currentCustomerName: displayTarget(row),
                              currentCustomerStatus: mapTargetForDrawer(tg.status),
                            })
                          }
                          className={cn(
                            "text-left font-medium underline decoration-primary/30 underline-offset-4",
                            "transition-colors hover:text-primary",
                            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                          )}
                        >
                          {t.name}
                        </button>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {taskTypeLabel(t.task_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          {channelLabel(t.channel)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-sm">
                        {displayTarget(row)}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{targetStatusLabel(tg.status)}</span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            taskStatusLabel(t.status, t.deadline) === "已逾期"
                              ? "destructive"
                              : "secondary"
                          }
                          className="font-normal"
                        >
                          {taskStatusLabel(t.status, t.deadline)}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                        {formatDue(t.deadline)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {t.channel === "wecom" ? (
                            <Button
                              size="sm"
                              variant="default"
                              className="gap-1"
                              disabled={
                                openingChat === row.row_id ||
                                !(tg.target_external_userid ?? "").trim()
                              }
                              onClick={async () => {
                                const ext = (tg.target_external_userid ?? "").trim();
                                if (!ext) {
                                  toast.message("当前对象缺少外部联系人 ID，无法打开会话");
                                  return;
                                }
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
                              aria-label="打开企微会话"
                            >
                              <MessageCircle className="size-3.5" />
                              {openingChat === row.row_id ? "打开中…" : "企微"}
                            </Button>
                          ) : null}
                          {t.channel === "phone" && phone ? (
                            tg.target_lead_id ? (
                              <Button
                                type="button"
                                size="sm"
                                className="gap-1"
                                aria-label="拨打电话并打开线索跟进"
                                onClick={() => {
                                  void router.push(
                                    `/leads/${tg.target_lead_id}/edit?entry=phone`
                                  );
                                  requestAnimationFrame(() => {
                                    window.location.href = `tel:${phone}`;
                                  });
                                }}
                              >
                                <Phone className="size-3.5" />
                                电话
                              </Button>
                            ) : (
                              <a
                                href={`tel:${phone}`}
                                className={cn(buttonVariants({ size: "sm" }), "gap-1")}
                              >
                                <Phone className="size-3.5" />
                                电话
                              </a>
                            )
                          ) : null}
                          {t.task_type === "mass_send" &&
                          (t.mass_content ?? "").trim() ? (
                            <>
                              {t.channel === "wecom" ? (
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="gap-1"
                                  disabled={
                                    massSendRow === row.row_id ||
                                    !(tg.target_external_userid ?? "").trim() ||
                                    isWeComMacMassSendLimited()
                                  }
                                  title={
                                    isWeComMacMassSendLimited()
                                      ? "Mac 端网页无法带入群发内容与客户，请复制后发送"
                                      : !(tg.target_external_userid ?? "").trim()
                                        ? "当前对象缺少 external_userid"
                                        : "企业微信内调起群发助手（shareToExternalContact）"
                                  }
                                  onClick={() => {
                                    void (async () => {
                                      const ext = (
                                        tg.target_external_userid ?? ""
                                      ).trim();
                                      const txt = (t.mass_content ?? "").trim();
                                      if (!ext || !txt) return;
                                      setMassSendRow(row.row_id);
                                      try {
                                        const r =
                                          await shareMassSendTextToExternalContacts(
                                            {
                                              content: txt,
                                              externalUserIds: [ext],
                                            }
                                          );
                                        if (!r.ok) {
                                          toast.error(r.message ?? "发起群发失败");
                                          return;
                                        }
                                        toast.success(
                                          "已调起群发助手，请在企业微信中确认发送"
                                        );
                                      } finally {
                                        setMassSendRow(null);
                                      }
                                    })();
                                  }}
                                >
                                  <Megaphone className="size-3.5" />
                                  {massSendRow === row.row_id
                                    ? "调用中…"
                                    : "发起群发"}
                                </Button>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              : null}
          </TableBody>
        </Table>
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
      <p className="text-center text-xs text-muted-foreground">
        数据来自后台 wecom_task / wecom_task_target；按任务对象展开展示。
      </p>
    </div>
  );
}
