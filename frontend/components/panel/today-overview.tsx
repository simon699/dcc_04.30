"use client";

import * as React from "react";

import { DEFAULT_LEAD_OWNER_USERID } from "@/components/leads/lead-drawer-panel";

type TodayKpisPayload = {
  date?: string;
  leads_next_follow_today?: number;
  tasks_due_today_total?: number;
  tasks_done_today?: number;
  tasks_undone_today?: number;
};

export function TodayOverview() {
  const now = new Date();
  const [kpis, setKpis] = React.useState<TodayKpisPayload | null>(null);
  const [kpiErr, setKpiErr] = React.useState(false);

  React.useEffect(() => {
    const q = new URLSearchParams();
    q.set("owner_userid", DEFAULT_LEAD_OWNER_USERID);
    q.set("creator_userid", DEFAULT_LEAD_OWNER_USERID);
    fetch(`/api/panel/today-kpis?${q.toString()}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json() as Promise<TodayKpisPayload>;
      })
      .then((d) => {
        setKpis(d);
        setKpiErr(false);
      })
      .catch(() => {
        setKpis(null);
        setKpiErr(true);
      });
  }, []);

  const leadsNeedFollowUp = kpis?.leads_next_follow_today ?? (kpiErr ? 0 : "—");
  const taskTotalToday = kpis?.tasks_due_today_total ?? (kpiErr ? 0 : "—");
  const doneToday = kpis?.tasks_done_today ?? (kpiErr ? 0 : "—");
  const undoneToday = kpis?.tasks_undone_today ?? (kpiErr ? 0 : "—");

  const monthlyLeadCount = 432;
  const monthlyFirstInviteCount = 168;
  const callHalfHourRate = 96.4;
  const blendedFollowFreq = 3.3;

  const dateLabel = now.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <h2 className="text-sm font-medium text-foreground">今日概览</h2>
        <p className="text-xs text-muted-foreground tabular-nums">{dateLabel}</p>
      </div>

      {kpiErr ? (
        <p className="text-xs text-destructive">
          今日指标加载失败（请确认后端已启动且已配置 MYSQL_URL）
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="今日需跟进线索" value={leadsNeedFollowUp} />
        <KpiTile label="今日任务" value={taskTotalToday} />
        <KpiTile label="当月线索量" value={monthlyLeadCount} />
        <KpiTile label="当月首邀量" value={monthlyFirstInviteCount} />
        <KpiTile
          label="0.5H外呼率"
          value={`${callHalfHourRate.toFixed(1)}%`}
          hint="目标 95% 以上"
        />
        <KpiTile
          label="融合跟进频次"
          value={blendedFollowFreq.toFixed(1)}
          hint="目标 3.0+"
        />
        <div className="rounded-xl border border-border/80 bg-card px-5 py-4 shadow-sm sm:col-span-2 xl:col-span-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            已完成 / 未完成
          </p>
          <div className="mt-4 grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-muted-foreground">已完成</p>
              <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight text-foreground">
                {doneToday}
              </p>
            </div>
            <div className="border-l border-border/60 pl-6">
              <p className="text-xs text-muted-foreground">未完成</p>
              <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight text-foreground">
                {undoneToday}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            今日任务总量 {taskTotalToday} 条
          </p>
        </div>
      </div>
    </section>
  );
}

function KpiTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-card px-5 py-4 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-4 text-4xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
