"use client";

import * as React from "react";
import { Check, History, MessageCircle, Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type FollowBucketKey,
  type LeadContactReach,
  contactReachLabel,
  getDemoLeadRowDisplay,
  getFollowingLeadMatrix,
  getFollowingLeadsInBuckets,
  getInitialTodayCallLogs,
  getMatrixCellLeads,
  type Lead,
  type TodayCallLogEntry,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";

import { TodayCallLog } from "@/components/panel/today-call-log";

/** 侧拉宽度约为视口 50%，表格信息更易完整展示 */
const SHEET_WIDE =
  "flex h-full w-full max-w-full flex-col gap-0 p-0 sm:!w-[50vw] sm:!max-w-[50vw]";

function formatNowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function randomDurationLabel(): string {
  const m = Math.floor(Math.random() * 4) + 1;
  const s = Math.floor(Math.random() * 60);
  return `${m}分${String(s).padStart(2, "0")}秒`;
}

function MatrixSheetRowActions({ lead }: { lead: Lead }) {
  const r: LeadContactReach = lead.contactReach ?? "both";
  const telHref = `tel:${lead.phone.replace(/\s/g, "")}`;

  const phoneBtn = (
    <a
      href={telHref}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-emerald-600/35 bg-emerald-600/10 text-emerald-700",
        "transition-colors hover:bg-emerald-600/20",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      )}
      title="拨打电话"
      aria-label={`拨打 ${lead.name} 的电话`}
    >
      <Phone className="size-4" aria-hidden />
    </a>
  );

  const wecomBtn = (
    <button
      type="button"
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-[#07C160]/35 bg-[#07C160]/10 text-[#07C160]",
        "transition-colors hover:bg-[#07C160]/20",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      )}
      title="企微联系（演示）"
      aria-label={`与 ${lead.name} 发起企微会话`}
      onClick={() => {
        toast.message(`打开与 ${lead.name} 的企微会话（演示）`);
      }}
    >
      <MessageCircle className="size-4" aria-hidden />
    </button>
  );

  if (r === "phone_only") {
    return <div className="flex justify-end">{phoneBtn}</div>;
  }
  if (r === "wecom_only") {
    return <div className="flex justify-end">{wecomBtn}</div>;
  }
  return (
    <div className="flex items-center justify-end gap-1">
      {phoneBtn}
      {wecomBtn}
    </div>
  );
}

export function FollowingLeadsPanel() {
  const router = useRouter();

  const [selected, setSelected] = React.useState<Set<FollowBucketKey>>(() => {
    return new Set<FollowBucketKey>([
      "priority",
      "vertical_media",
      "live_stream",
      "new_lead",
      "activation",
      "revisit",
      "outbound",
    ]);
  });
  const [callLogs, setCallLogs] = React.useState<TodayCallLogEntry[]>(() =>
    getInitialTodayCallLogs()
  );

  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [sheetTitle, setSheetTitle] = React.useState("");
  const [sheetRows, setSheetRows] = React.useState<Lead[]>([]);

  const [callLogOpen, setCallLogOpen] = React.useState(false);

  const matrixRows = React.useMemo(() => getFollowingLeadMatrix("phone"), []);

  function toggleBucket(key: FollowBucketKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function openCellList(
    bucketKey: FollowBucketKey,
    overdue: boolean,
    bucketLabel: string
  ) {
    const leads = getMatrixCellLeads(bucketKey, overdue, "phone");
    setSheetRows(leads);
    setSheetTitle(
      `${bucketLabel} · ${overdue ? "逾期" : "未逾期"}（${leads.length}）`
    );
    setSheetOpen(true);
  }

  function startOutboundCall() {
    if (selected.size === 0) {
      toast.message("请先勾选左侧分类");
      return;
    }
    const leads = getFollowingLeadsInBuckets(selected, "phone");
    if (leads.length === 0) {
      toast.message("所选分类下暂无可电话联系线索（演示：部分线索仅支持企微）");
      return;
    }

    const now = formatNowTime();
    const newEntries: TodayCallLogEntry[] = leads.map((lead, i) => ({
      id: `out-${Date.now()}-${i}`,
      leadId: lead.id,
      timeLabel: now,
      name: lead.name,
      phone: lead.phone,
      durationLabel: randomDurationLabel(),
      result: i === 0 ? "外呼已发起（演示）" : "排队中（演示）",
    }));

    setCallLogs((prev) => [...newEntries, ...prev]);
    const firstLead = leads[0];
    if (firstLead) {
      router.push(`/leads/${firstLead.id}/edit?entry=phone`);
      if (leads.length > 1) {
        toast.success(
          `已打开 ${firstLead.name} 的电话跟进页（其余 ${leads.length - 1} 位可继续逐条处理）`
        );
      }
      return;
    }
    toast.success(`已对 ${leads.length} 位客户发起外呼（演示）`);
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex w-full items-center gap-3 sm:gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={startOutboundCall}
              className={cn(
                "flex size-14 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg",
                "transition-colors hover:bg-emerald-700",
                "focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:outline-none"
              )}
              aria-label="打电话"
            >
              <Phone className="size-7 stroke-[2]" aria-hidden />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setCallLogOpen(true)}
            className={cn(
              "shrink-0 border-0 bg-transparent p-0 text-sm font-medium text-muted-foreground shadow-none",
              "underline decoration-muted-foreground/50 underline-offset-4",
              "hover:text-foreground hover:decoration-foreground/40",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            )}
          >
            通话记录
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-md">
          <div className="flex items-center gap-3 border-b border-border/60 bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span className="w-5 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">分类</span>
            <div className="flex shrink-0 items-center gap-0 text-[11px] uppercase tracking-wider">
              <span className="w-14 text-center">未逾期</span>
              <span className="mx-1 h-3 w-px shrink-0 bg-border" aria-hidden />
              <span className="w-14 text-center">逾期</span>
            </div>
          </div>
          <ul className="divide-y divide-border/50">
            {matrixRows.map((row) => {
              const checked = selected.has(row.key);
              return (
                <li key={row.key}>
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => toggleBucket(row.key)}
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded border border-input bg-background shadow-xs transition-colors",
                        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        checked &&
                          "border-primary bg-primary text-primary-foreground"
                      )}
                      aria-pressed={checked}
                      aria-label={`选择 ${row.label}`}
                    >
                      {checked ? (
                        <Check className="size-3 stroke-[3]" />
                      ) : null}
                    </button>
                    <span className="min-w-0 flex-1 text-sm text-foreground">
                      {row.label}
                    </span>
                    <div className="flex shrink-0 items-center justify-end gap-0">
                      <MetricButton
                        value={row.notOverdue}
                        title="未逾期"
                        onPress={() =>
                          openCellList(row.key, false, row.label)
                        }
                      />
                      <span
                        className="mx-2 h-4 w-px shrink-0 bg-border/80"
                        aria-hidden
                      />
                      <MetricButton
                        value={row.overdue}
                        title="逾期"
                        onPress={() =>
                          openCellList(row.key, true, row.label)
                        }
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <Sheet open={callLogOpen} onOpenChange={setCallLogOpen}>
        <SheetContent className={SHEET_WIDE}>
          <SheetHeader className="border-b px-6 py-4 text-left">
            <SheetTitle className="flex items-center gap-2">
              <History className="size-4 text-muted-foreground" aria-hidden />
              今日通话记录
            </SheetTitle>
            <SheetDescription>
              共 {callLogs.length} 条 · 外呼后会在顶部追加演示条目
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-hidden px-2 pb-4 pt-2">
            <TodayCallLog entries={callLogs} embedded />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className={SHEET_WIDE}>
          <SheetHeader className="border-b px-6 py-4 text-left">
            <SheetTitle>{sheetTitle}</SheetTitle>
            <SheetDescription>
              意向车型、等级、备注为演示数据；「触达」为线索可联系方式
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 px-4 py-4">
            {sheetRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                暂无数据
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">姓名</TableHead>
                    <TableHead className="whitespace-nowrap">触达</TableHead>
                    <TableHead className="whitespace-nowrap">手机号</TableHead>
                    <TableHead className="whitespace-nowrap">意向车型</TableHead>
                    <TableHead className="whitespace-nowrap">等级</TableHead>
                    <TableHead>备注</TableHead>
                    <TableHead className="w-[120px] text-right whitespace-nowrap">
                      操作
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sheetRows.map((lead) => {
                    const d = getDemoLeadRowDisplay(lead);
                    return (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">
                          {lead.name}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {contactReachLabel(lead.contactReach)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {lead.phone}
                        </TableCell>
                        <TableCell>{d.intentModel}</TableCell>
                        <TableCell>{d.level}</TableCell>
                        <TableCell className="min-w-[200px] text-muted-foreground text-xs">
                          {d.remark}
                        </TableCell>
                        <TableCell className="align-middle">
                          <MatrixSheetRowActions lead={lead} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

    </>
  );
}

function MetricButton({
  value,
  title,
  onPress,
}: {
  value: number;
  title: string;
  onPress: () => void;
}) {
  if (value === 0) {
    return (
      <span
        className="inline-flex w-14 justify-center tabular-nums text-sm text-muted-foreground"
        title={title}
      >
        0
      </span>
    );
  }
  return (
    <button
      type="button"
      title={title}
      onClick={onPress}
      className="inline-flex w-14 justify-center text-sm font-medium tabular-nums text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:text-primary/80"
    >
      {value}
    </button>
  );
}
