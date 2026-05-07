import { getTodayKpis } from "@/lib/mock-data";

export function TodayOverview() {
  const now = new Date();
  const { leadsNeedFollowUp, taskTotalToday, doneToday, undoneToday } =
    getTodayKpis(now);
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
