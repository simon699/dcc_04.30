"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  MessageCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getTask,
  getWecomTaskPanelDetail,
  splitPendingWecomTasksByOverdue,
  type Task,
  wecomTaskDisplayTag,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const SHEET_WIDE =
  "flex h-full w-full max-w-full flex-col gap-0 p-0 sm:!w-[50vw] sm:!max-w-[50vw]";

function formatDue(dueAt: string): string {
  return new Date(dueAt).toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function taskProgressLine(task: Task): string {
  const d = getWecomTaskPanelDetail(task);
  return `${d.sentCount}/${d.customerTotal}（${d.sendPercent}%）`;
}

export function TodayWecomTasks() {
  const router = useRouter();
  const { notOverdue, overdue } = splitPendingWecomTasksByOverdue();
  const [tab, setTab] = React.useState<"not_overdue" | "overdue">(
    "not_overdue"
  );
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [activeTaskId, setActiveTaskId] = React.useState<string | null>(null);

  const tasks = tab === "not_overdue" ? notOverdue : overdue;
  const activeTask = activeTaskId ? getTask(activeTaskId) : undefined;
  const detail = activeTask ? getWecomTaskPanelDetail(activeTask) : null;
  const [openGroups, setOpenGroups] = React.useState({
    pending: true,
    done: true,
    failed: true,
  });

  function openDetail(taskId: string) {
    setActiveTaskId(taskId);
    setOpenGroups({ pending: true, done: true, failed: true });
    setSheetOpen(true);
  }

  return (
    <>
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "not_overdue" | "overdue")}
        className="w-full"
      >
        <TabsList
          variant="line"
          className="mb-3 h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0"
        >
          <TabsTrigger value="not_overdue" className="px-3 py-2">
            未逾期任务（{notOverdue.length}）
          </TabsTrigger>
          <TabsTrigger value="overdue" className="px-3 py-2">
            逾期任务（{overdue.length}）
          </TabsTrigger>
        </TabsList>

        <TabsContent value="not_overdue" className="mt-0 space-y-0">
          <TaskListBody
            tasks={notOverdue}
            emptyHint="暂无未逾期企微任务"
            onOpenDetail={openDetail}
          />
        </TabsContent>
        <TabsContent value="overdue" className="mt-0 space-y-0">
          <TaskListBody
            tasks={overdue}
            emptyHint="暂无逾期企微任务"
            onOpenDetail={openDetail}
          />
        </TabsContent>
      </Tabs>

      <Sheet
        open={sheetOpen}
        onOpenChange={(o) => {
          setSheetOpen(o);
          if (!o) setActiveTaskId(null);
        }}
      >
        <SheetContent className={SHEET_WIDE}>
          <SheetHeader className="border-b px-6 py-4 text-left">
            <SheetTitle className="pr-8 leading-snug">
              {detail?.title ?? "任务详情"}
            </SheetTitle>
            <SheetDescription>
              企微发送任务明细（演示数据）
            </SheetDescription>
          </SheetHeader>
          {detail && activeTask ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      detail.tagKind === "mass" ? "secondary" : "outline"
                    }
                    className="font-normal"
                  >
                    {detail.tagLabel}
                  </Badge>
                  {activeTask.status === "overdue" ? (
                    <Badge variant="destructive" className="font-normal">
                      已逾期
                    </Badge>
                  ) : null}
                </div>

                <dl className="grid gap-4 text-sm">
                  <div>
                    <dt className="text-muted-foreground">任务名称</dt>
                    <dd className="mt-1 font-medium">{detail.title}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">截止时间</dt>
                    <dd className="mt-1 font-medium">
                      {new Date(detail.dueAt).toLocaleString("zh-CN")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">客户总数</dt>
                    <dd className="mt-1 font-medium tabular-nums">
                      {detail.customerTotal}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">发送进度</dt>
                    <dd className="mt-1 font-medium tabular-nums">
                      {detail.sentCount}/{detail.customerTotal}（
                      {detail.sendPercent}%）
                    </dd>
                  </div>
                </dl>

                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">
                    发送内容
                  </h4>
                  <p className="mt-2 whitespace-pre-wrap rounded-md border border-border/60 bg-muted/30 p-3 text-sm leading-relaxed">
                    {detail.sendContent}
                  </p>
                </div>

                <Separator />

                <CustomerBlock
                  title="未完成客户"
                  names={detail.pendingCustomers}
                  empty="暂无"
                  open={openGroups.pending}
                  onToggle={() =>
                    setOpenGroups((prev) => ({
                      ...prev,
                      pending: !prev.pending,
                    }))
                  }
                />
                <CustomerBlock
                  title="已完成客户"
                  names={detail.doneCustomers}
                  empty="暂无"
                  open={openGroups.done}
                  onToggle={() =>
                    setOpenGroups((prev) => ({
                      ...prev,
                      done: !prev.done,
                    }))
                  }
                />
                <CustomerBlock
                  title="发送失败客户"
                  names={detail.failedCustomers}
                  empty="暂无"
                  open={openGroups.failed}
                  onToggle={() =>
                    setOpenGroups((prev) => ({
                      ...prev,
                      failed: !prev.failed,
                    }))
                  }
                />
              </div>
            </div>
          ) : null}

          <div className="mt-auto border-t px-6 py-4">
            {activeTask ? (
              <Button
                className="mb-2 w-full"
                onClick={() => {
                  toast.success("已开始发送（演示）");
                }}
              >
                发送
              </Button>
            ) : null}
            {activeTask ? (
              <Button
                variant="outline"
                className="mb-2 w-full justify-start gap-2"
                onClick={() => {
                  setSheetOpen(false);
                  router.push(`/wecom?taskId=${activeTask.id}`);
                }}
              >
                <MessageCircle className="size-4" />
                进入企微工作台
                <ExternalLink className="ml-auto size-4 opacity-60" />
              </Button>
            ) : null}
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setSheetOpen(false)}
            >
              关闭
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function CustomerBlock({
  title,
  names,
  empty,
  open,
  onToggle,
}: {
  title: string;
  names: string[];
  empty: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left",
          "transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <h4 className="text-sm font-medium text-muted-foreground">
          {title}
          <span className="ml-2 tabular-nums text-foreground">
            （{names.length}）
          </span>
        </h4>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            open ? "rotate-0" : "-rotate-90"
          )}
          aria-hidden
        />
      </button>
      {open ? (
        names.length === 0 ? (
          <p className="mt-2 px-2 text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="mt-2 max-h-36 list-inside list-disc space-y-1 overflow-y-auto px-2 text-sm">
            {names.map((n, i) => (
              <li key={`${n}-${i}`}>{n}</li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}

function TaskListBody({
  tasks,
  emptyHint,
  onOpenDetail,
}: {
  tasks: Task[];
  emptyHint: string;
  onOpenDetail: (id: string) => void;
}) {
  if (tasks.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {emptyHint}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border/60">
      {tasks.map((task) => {
        const tag = wecomTaskDisplayTag(task.id);
        return (
          <li key={task.id}>
            <button
              type="button"
              onClick={() => onOpenDetail(task.id)}
              className={cn(
                "flex w-full flex-col gap-2 py-3 text-left transition-colors",
                "hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        tag.kind === "mass" ? "secondary" : "outline"
                      }
                      className="shrink-0 font-normal"
                    >
                      {tag.label}
                    </Badge>
                    <span className="truncate font-medium">{task.title}</span>
                  </div>
                  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-muted-foreground sm:text-sm">
                    <span>截止 {formatDue(task.dueAt)}</span>
                    <span className="tabular-nums text-foreground">
                      任务进度：{taskProgressLine(task)}
                    </span>
                  </div>
                </div>
                <span
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "icon" }),
                    "pointer-events-none shrink-0 text-muted-foreground"
                  )}
                  aria-hidden
                >
                  <ChevronRight className="size-4" />
                </span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
