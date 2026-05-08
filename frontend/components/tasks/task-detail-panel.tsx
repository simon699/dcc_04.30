"use client";

import * as React from "react";
import Link from "next/link";
import { Megaphone } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { copyPlainText } from "@/lib/copy-to-clipboard";
import {
  isWeComMacMassSendLimited,
  shareMassSendTextToExternalContacts,
} from "@/lib/wecom-mass-send";

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
    target_lead_id?: string | null;
    target_display_name?: string | null;
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
  const [massSendBusy, setMassSendBusy] = React.useState(false);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初始/切换任务时拉取详情
    load();
  }, [load]);

  const preferredExternalUserid = React.useMemo(() => {
    if (!data) return "";
    if (highlightTargetId) {
      const tg = data.targets.find((x) => String(x.id) === highlightTargetId);
      return (tg?.target_external_userid ?? "").trim();
    }
    const hit = data.targets.find((x) =>
      (x.target_external_userid ?? "").trim()
    );
    return (hit?.target_external_userid ?? "").trim();
  }, [data, highlightTargetId]);

  const massPlain = React.useMemo(
    () => (data?.mass_content ?? "").trim(),
    [data]
  );

  const sortedTargets = React.useMemo(() => {
    if (!data?.targets?.length) return [];
    return [...data.targets].sort((a, b) => a.id - b.id);
  }, [data]);

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

      {data.task_type === "mass_send" ? (
        <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-sm">
          <p className="text-xs text-muted-foreground">群发内容</p>
          <p className="mt-1 whitespace-pre-wrap">
            {massPlain || "（未配置群发正文）"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!massPlain}
              onClick={async () => {
                const ok = await copyPlainText(massPlain);
                toast[ok ? "success" : "error"](
                  ok ? "已复制到剪贴板，可自行粘贴发送" : "复制失败"
                );
              }}
            >
              复制内容
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={
                massSendBusy ||
                !massPlain ||
                !preferredExternalUserid ||
                data.channel !== "wecom" ||
                isWeComMacMassSendLimited()
              }
              title={
                isWeComMacMassSendLimited()
                  ? "Mac 端企业微信网页无法带入群发正文与客户（官方限制），请用复制内容"
                  : data.channel !== "wecom"
                    ? "非企微渠道任务请使用复制后自行触达"
                    : !preferredExternalUserid
                      ? "任务对象缺少 external_userid，无法调起客户端群发"
                      : "企业微信内使用 JS-SDK shareToExternalContact（官方文档 93555）"
              }
              onClick={() => {
                void (async () => {
                  setMassSendBusy(true);
                  try {
                    const r = await shareMassSendTextToExternalContacts({
                      content: massPlain,
                      externalUserIds: [preferredExternalUserid],
                    });
                    if (!r.ok) {
                      toast.error(r.message ?? "发起群发失败");
                      return;
                    }
                    toast.success(
                      "已调起群发助手，请在企业微信客户端内确认发送"
                    );
                  } finally {
                    setMassSendBusy(false);
                  }
                })();
              }}
            >
              <Megaphone className="mr-1 size-3.5" />
              {massSendBusy ? "调用中…" : "发起群发"}
            </Button>
          </div>
          {isWeComMacMassSendLimited() ? (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-500">
              Mac 端企业微信不支持从网页向群发助手传入正文与客户（官方文档约 93594），助手内会显示为空；请「复制内容」后在手机端或 Windows
              客户端发起群发。
            </p>
          ) : !preferredExternalUserid ? (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-500">
              当前任务对象无企微 external_userid，仅可复制正文后手动发送。
            </p>
          ) : null}
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
              const disp =
                (t.target_display_name ?? "").trim() ||
                (t.target_external_userid ?? "").trim() ||
                (t.target_phone ?? "").trim() ||
                "—";
              const rawExt = (t.target_external_userid ?? "").trim();
              const rawPh = (t.target_phone ?? "").trim();
              const sub =
                disp !== rawExt && rawExt
                  ? rawExt
                  : disp !== rawPh && rawPh
                    ? rawPh
                    : "";
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
                    <span className="text-sm font-medium">{disp}</span>
                    <Badge variant="outline" className="font-normal">
                      {targetStatusLabel(t.status)}
                    </Badge>
                  </div>
                  {sub ? (
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      {sub}
                    </p>
                  ) : null}
                  <div className="mt-1 text-xs text-muted-foreground">
                    开始 {formatDt(t.started_at)} · 完成 {formatDt(t.completed_at)}
                  </div>
                  {t.remark ? (
                    <p className="mt-1 text-xs">{t.remark}</p>
                  ) : null}
                  {data.channel === "phone" &&
                  (t.target_lead_id ?? "").trim() ? (
                    <div className="mt-2">
                      <Link
                        href={`/leads/${(t.target_lead_id ?? "").trim()}/edit?entry=phone`}
                        className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                      >
                        进入线索编辑（电话跟进）
                      </Link>
                    </div>
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
