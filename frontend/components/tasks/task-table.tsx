"use client";

import * as React from "react";
import { MessageCircle, Phone } from "lucide-react";

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
import {
  type FollowBucketKey,
  type Task,
  MOCK_TASKS,
  channelLabel,
  followingLeads,
  getFollowBucketLabel,
  getLead,
  getLeadByName,
  getLeadNearestOpenTaskDueAt,
  getWecomTaskPanelDetail,
  leadHasOverdueTask,
  leadMatchesContactMode,
  taskStatusLabel,
} from "@/lib/mock-data";
import { useUiStore } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";
type Filter = "all" | "phone" | "wecom";
type StatusFilter = "all" | "pending" | "done" | "overdue";

const PAGE_SIZE = 6;
const TASK_CENTER_TASKS = MOCK_TASKS.filter(
  (t) => t.channel === "phone" || t.channel === "wecom"
);

type CustomerTaskRow = {
  rowId: string;
  task: Task;
  leadName: string;
  leadId: string;
  leadPhone: string;
  customerName: string;
  customerStatus: "pending" | "done" | "failed";
};

function filterTasks(list: Task[], f: Filter): Task[] {
  if (f === "all") return list;
  return list.filter((t) => t.channel === f);
}

function formatDue(dueAt: string): string {
  return new Date(dueAt).toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function customerStatusLabel(status: CustomerTaskRow["customerStatus"]): string {
  if (status === "done") return "已完成";
  if (status === "failed") return "发送失败";
  return "未发送";
}

function formatDateKey(dateLike: string): string {
  const d = new Date(dateLike);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function matchKeyword(row: CustomerTaskRow, keyword: string): boolean {
  const q = keyword.trim().toLowerCase();
  if (!q) return true;
  return [row.task.title, row.customerName, row.leadPhone]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

function matchDueDate(row: CustomerTaskRow, date: string): boolean {
  if (!date) return true;
  return formatDateKey(row.task.dueAt) === date;
}

function matchStatus(row: CustomerTaskRow, status: StatusFilter): boolean {
  if (status === "all") return true;
  return row.task.status === status;
}

function buildCustomerRows(tasks: Task[]): CustomerTaskRow[] {
  const rows: CustomerTaskRow[] = [];
  for (const task of tasks) {
    const lead = getLead(task.leadId);
    if (!lead) continue;

    if (task.channel === "phone") {
      rows.push({
        rowId: `${task.id}-${lead.id}`,
        task,
        leadId: lead.id,
        leadName: lead.name,
        leadPhone: lead.phone,
        customerName: lead.name,
        customerStatus: task.status === "done" ? "done" : "pending",
      });
      continue;
    }

    const detail = getWecomTaskPanelDetail(task);
    detail.pendingCustomers.forEach((name, idx) => {
      const leadOfCustomer = getLeadByName(name) ?? lead;
      rows.push({
        rowId: `${task.id}-pending-${name}-${idx}`,
        task,
        leadId: leadOfCustomer.id,
        leadName: leadOfCustomer.name,
        leadPhone: leadOfCustomer.phone,
        customerName: name,
        customerStatus: "pending",
      });
    });
    detail.doneCustomers.forEach((name, idx) => {
      const leadOfCustomer = getLeadByName(name) ?? lead;
      rows.push({
        rowId: `${task.id}-done-${name}-${idx}`,
        task,
        leadId: leadOfCustomer.id,
        leadName: leadOfCustomer.name,
        leadPhone: leadOfCustomer.phone,
        customerName: name,
        customerStatus: "done",
      });
    });
    detail.failedCustomers.forEach((name, idx) => {
      const leadOfCustomer = getLeadByName(name) ?? lead;
      rows.push({
        rowId: `${task.id}-failed-${name}-${idx}`,
        task,
        leadId: leadOfCustomer.id,
        leadName: leadOfCustomer.name,
        leadPhone: leadOfCustomer.phone,
        customerName: name,
        customerStatus: "failed",
      });
    });
  }
  return rows;
}

function buildPhoneGroupRows(): CustomerTaskRow[] {
  const rows: CustomerTaskRow[] = [];
  const leads = followingLeads().filter(
    (l) => l.followBucket && leadMatchesContactMode(l, "phone")
  );
  for (const lead of leads) {
    const bucketKey = lead.followBucket as FollowBucketKey;
    const pseudoTask: Task = {
      id: `phone-group-${bucketKey}`,
      title: getFollowBucketLabel(bucketKey),
      channel: "phone",
      status: leadHasOverdueTask(lead.id) ? "overdue" : "pending",
      dueAt: getLeadNearestOpenTaskDueAt(lead.id),
      leadId: lead.id,
      description: "电话跟进分类任务（按工作面板分类聚合）",
    };
    rows.push({
      rowId: `${pseudoTask.id}-${lead.id}`,
      task: pseudoTask,
      leadId: lead.id,
      leadName: lead.name,
      leadPhone: lead.phone,
      customerName: lead.name,
      customerStatus: "pending",
    });
  }
  return rows;
}

export function TaskTable() {
  const openDrawer = useUiStore((s) => s.openDrawer);
  const [tab, setTab] = React.useState<Filter>("all");
  const [keyword, setKeyword] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [page, setPage] = React.useState(1);

  const rows = React.useMemo(() => {
    const sourceRows =
      tab === "phone"
        ? buildPhoneGroupRows()
        : tab === "wecom"
          ? buildCustomerRows(filterTasks(TASK_CENTER_TASKS, "wecom"))
          : [
              ...buildPhoneGroupRows(),
              ...buildCustomerRows(filterTasks(TASK_CENTER_TASKS, "wecom")),
            ];
    return sourceRows.filter(
      (row) =>
        matchKeyword(row, keyword) &&
        matchDueDate(row, dueDate) &&
        matchStatus(row, statusFilter)
    );
  }, [tab, keyword, dueDate, statusFilter]);

  React.useEffect(() => {
    setPage(1);
  }, [tab, keyword, dueDate, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = React.useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, currentPage]);

  return (
    <div className="space-y-4">
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as Filter)}
        className="w-full"
      >
        <TabsList className="h-9 w-full flex-wrap justify-start gap-1 bg-transparent p-0">
          <TabsTrigger value="all" className="data-[state=active]:bg-background">
            全部
          </TabsTrigger>
          <TabsTrigger
            value="phone"
            className="data-[state=active]:bg-background"
          >
            电话跟进
          </TabsTrigger>
          <TabsTrigger
            value="wecom"
            className="data-[state=active]:bg-background"
          >
            企微跟进
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-2 sm:grid-cols-3">
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="手机号 / 任务名称 / 客户名称"
        />
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs",
            "focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
          )}
          aria-label="状态筛选"
        >
          <option value="all">状态：全部</option>
          <option value="pending">状态：待办</option>
          <option value="overdue">状态：已逾期</option>
          <option value="done">状态：已完成</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[220px]">任务</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>当前客户</TableHead>
              <TableHead>关联线索</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>截止时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  暂无匹配任务
                </TableCell>
              </TableRow>
            ) : null}
            {pagedRows.map((row) => {
              const task = row.task;
              return (
                <TableRow key={row.rowId}>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => {
                        const isPhoneGroup = task.id.startsWith("phone-group-");
                        openDrawer({
                          type: "task",
                          id: task.id,
                          phoneGroupKey: isPhoneGroup
                            ? task.id.replace("phone-group-", "")
                            : undefined,
                          currentLeadId: row.leadId,
                          currentCustomerName: row.customerName,
                          currentCustomerStatus: row.customerStatus,
                        });
                      }}
                      className={cn(
                        "text-left font-medium underline decoration-primary/30 underline-offset-4",
                        "transition-colors hover:text-primary",
                        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      )}
                    >
                      {task.title}
                    </button>
                    {task.channel === "wecom" ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {getWecomTaskPanelDetail(task).tagKind === "followup"
                          ? "单客户跟进任务"
                          : `多客户汇总：${getWecomTaskPanelDetail(task).customerTotal} 人`}
                      </p>
                    ) : task.id.startsWith("phone-group-") ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        电话分类任务：同分类下线索分别跟进
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal">
                      {channelLabel(task.channel)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <span>{row.customerName}</span>
                    {task.channel === "wecom" ? (
                      <span className="ml-2 text-xs">
                        ({customerStatusLabel(row.customerStatus)})
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {row.leadName ? (
                      <button
                        type="button"
                        onClick={() => openDrawer({ type: "lead", id: row.leadId })}
                        className={cn(
                          "text-muted-foreground underline decoration-muted-foreground/40 underline-offset-4",
                          "transition-colors hover:text-foreground",
                          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        )}
                      >
                        {row.leadName}
                      </button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        task.status === "overdue" ? "destructive" : "secondary"
                      }
                      className="font-normal"
                    >
                      {taskStatusLabel(task.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                    {formatDue(task.dueAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {task.channel === "wecom" ? (
                        <Button
                          size="sm"
                          variant="default"
                          className="gap-1"
                          onClick={() =>
                            openDrawer({
                              type: "wecom_image",
                              leadId: row.leadId,
                            })
                          }
                          aria-label="企微跟进"
                        >
                          <MessageCircle className="size-3.5" />
                          企微
                        </Button>
                      ) : null}
                      {task.channel === "phone" ? (
                        <a
                          href={`tel:${row.leadPhone.replace(/\s/g, "")}`}
                          className={cn(buttonVariants({ size: "sm" }), "gap-1")}
                          aria-label="拨打电话"
                        >
                          <Phone className="size-3.5" />
                          电话
                        </a>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          共 {rows.length} 条 · 第 {currentPage}/{pageCount} 页
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            上一页
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          >
            下一页
          </Button>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        企微任务按客户展开为多条记录；点击任务名称查看汇总任务详情。
      </p>
    </div>
  );
}
