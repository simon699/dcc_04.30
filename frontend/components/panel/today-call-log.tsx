import type { TodayCallLogEntry } from "@/lib/mock-data";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Phone } from "lucide-react";

function groupEntriesByLead(entries: TodayCallLogEntry[]) {
  const grouped = new Map<
    string,
    { leadName: string; phone: string; records: TodayCallLogEntry[] }
  >();
  for (const entry of entries) {
    const key = entry.leadId ?? `${entry.name}__${entry.phone}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.records.push(entry);
      continue;
    }
    grouped.set(key, {
      leadName: entry.name,
      phone: entry.phone,
      records: [entry],
    });
  }
  return [...grouped.values()];
}

function LogList({ entries }: { entries: TodayCallLogEntry[] }) {
  const leadGroups = groupEntriesByLead(entries);
  return (
    <ScrollArea className="h-[min(420px,calc(100vh-12rem))]">
      <ul className="divide-y divide-border/50 p-0">
        {leadGroups.length === 0 ? (
          <li className="px-3 py-6 text-center text-xs text-muted-foreground">
            今日暂无记录
          </li>
        ) : (
          leadGroups.map((group, i) => (
            <li key={`${group.leadName}-${group.phone}-${i}`} className="px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-foreground">
                  {group.leadName}
                </span>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {group.records.length} 通
                </span>
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                <span className="font-mono">{group.phone}</span>
              </div>
              <ul className="mt-2 space-y-1.5">
                {group.records.map((record) => (
                  <li
                    key={record.id}
                    className="rounded-md border border-border/60 bg-muted/20 px-2 py-1.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-medium tabular-nums text-muted-foreground">
                        {record.timeLabel}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {record.durationLabel}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-primary/90">
                      {record.result}
                    </p>
                  </li>
                ))}
              </ul>
            </li>
          ))
        )}
      </ul>
    </ScrollArea>
  );
}

export function TodayCallLog({
  entries,
  embedded,
}: {
  entries: TodayCallLogEntry[];
  /** 嵌入 Sheet 时不重复外层标题栏 */
  embedded?: boolean;
}) {
  if (embedded) {
    return <LogList entries={entries} />;
  }

  return (
    <div className="flex h-full min-h-[200px] flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-3 py-2">
        <Phone className="size-3.5 text-muted-foreground" aria-hidden />
        <span className="text-xs font-medium text-foreground">今日通话记录</span>
        <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
          {entries.length} 条
        </span>
      </div>
      <LogList entries={entries} />
    </div>
  );
}
