"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export type ApiTaskDetail = {
  id: string;
  task_type: string;
  channel: string;
  name: string;
  description: string | null;
  mass_content: string | null;
  created_at: string | null;
  start_at: string | null;
  creator_userid: string;
  status: string;
  deadline: string | null;
  completed_at: string | null;
  updated_at: string | null;
  targets: Array<{
    id: number;
    target_external_userid: string | null;
    target_phone: string | null;
    status: string;
    started_at: string | null;
    completed_at: string | null;
    remark: string | null;
  }>;
};

function taskTypeLabel(t: string): string {
  if (t === "mass_send") return "群发任务";
  if (t === "follow_up") return "跟进任务";
  return t;
}

function channelLabelApi(ch: string): string {
  if (ch === "phone") return "电话";
  if (ch === "wecom") return "企微";
  return ch;
}

function taskStatusLabelApi(s: string): string {
  switch (s) {
    case "pending":
      return "待办";
    case "in_progress":
      return "进行中";
    case "done":
      return "已完成";
    case "cancelled":
      return "已取消";
    default:
      return s;
  }
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

function formatDt(v: string | null | undefined): string {
  if (!v) return "—";
  return new Date(v).toLocaleString("zh-CN");
}

export function TaskDetailPanel({
  taskId,
  highlightTargetId,
}: {
  taskId: string;
  highlightTargetId?: string;
}) {
  const [data, setData] = React.useState<ApiTaskDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    setErr(null);
    fetch(`/api/tasks/${encodeURIComponent(taskId)}`)
      .then(async (r) => {
        if (r.status === 404) {
          setData(null);
          setErr("任务不存在");
          return;
        }
        if (!r.ok) throw new Error(await r.text());
        return r.json() as Promise<ApiTaskDetail>;
      })
      .then((d) => {
        if (d) setData(d);
      })
      .catch((e: Error) => {
        setData(null);
        setErr(e.message || "加载失败");
      })
      .finally(() => setLoading(false));
  }, [taskId]);

  React.useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">加载任务…</p>;
  }

  if (err || !data) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{err ?? "无法加载"}</p>
        <Button size="sm" variant="outline" onClick={() => load()}>
          重试
        </Button>
      </div>
    );
  }

  const sortedTargets = [...data.targets].sort((a, b) => a.id - b.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{taskTypeLabel(data.task_type)}</Badge>
        <Badge variant="outline">{channelLabelApi(data.channel)}</Badge>
        <Badge variant="outline">{taskStatusLabelApi(data.status)}</Badge>
      </div>

      <div>
        <h3 className="text-base font-semibold">{data.name}</h3>
        {data.description ? (
          <p className="mt-2 text-sm text-muted-foreground">{data.description}</p>
        ) : null}
      </div>

      {data.task_type === "mass_send" && data.mass_content ? (
        <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-sm">
          <p className="text-xs text-muted-foreground">群发内容</p>
          <p className="mt-1 whitespace-pre-wrap">{data.mass_content}</p>
        </div>
      ) : null}

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">创建人</dt>
          <dd>{data.creator_userid}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">创建时间</dt>
          <dd>{formatDt(data.created_at)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">开始执行</dt>
          <dd>{formatDt(data.start_at)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">截止时间</dt>
          <dd>{formatDt(data.deadline)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">任务完成</dt>
          <dd>{formatDt(data.completed_at)}</dd>
        </div>
      </dl>

      <Separator />

      <div>
        <p className="mb-2 text-sm font-medium">任务对象</p>
        <ul className="space-y-2">
          {sortedTargets.length === 0 ? (
            <li className="text-sm text-muted-foreground">无对象</li>
          ) : (
            sortedTargets.map((t) => {
              const key = String(t.id);
              const on =
                highlightTargetId != null && highlightTargetId === key;
              const label =
                t.target_external_userid?.trim() ||
                t.target_phone?.trim() ||
                "—";
              return (
                <li
                  key={t.id}
                  className={
                    on
                      ? "rounded-md border border-primary bg-primary/5 px-3 py-2 text-sm"
                      : "rounded-md border border-border/60 px-3 py-2 text-sm"
                  }
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs">{label}</span>
                    <Badge variant="outline" className="font-normal">
                      {targetStatusLabel(t.status)}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    开始 {formatDt(t.started_at)} · 完成 {formatDt(t.completed_at)}
                  </div>
                  {t.remark ? (
                    <p className="mt-1 text-xs">{t.remark}</p>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
