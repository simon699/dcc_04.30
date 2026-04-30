"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MOCK_LEADS,
  type LeadLevelGrade,
  getDemoLeadRowDisplay,
  getLeadDetailDisplay,
  leadStatusLabel,
} from "@/lib/mock-data";
import { useUiStore } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";

type LevelFilter = "all" | LeadLevelGrade;
type ModelFilter = "all" | "XC60" | "XC70" | "EM90" | "XC30";
const PAGE_SIZE = 8;

function formatPhone(phone?: string): string {
  const raw = (phone ?? "").trim();
  if (!raw) return "—";
  if (raw.startsWith("+86")) return raw.slice(3);
  return raw;
}

function formatDateTime(v: string): string {
  return new Date(v).toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateKey(v: string): string {
  const d = new Date(v);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function LeadList() {
  const openDrawer = useUiStore((s) => s.openDrawer);
  const [keyword, setKeyword] = React.useState("");
  const [levelFilter, setLevelFilter] = React.useState<LevelFilter>("all");
  const [modelFilter, setModelFilter] = React.useState<ModelFilter>("all");
  const [nextFollowDate, setNextFollowDate] = React.useState("");
  const [createdDate, setCreatedDate] = React.useState("");
  const [page, setPage] = React.useState(1);

  const rows = React.useMemo(() => {
    return MOCK_LEADS.map((lead) => {
      const d = getDemoLeadRowDisplay(lead);
      const detail = getLeadDetailDisplay(lead);
      return {
        lead,
        level: d.level,
        intentModel: d.intentModel,
        nextFollowUpAt: detail.nextFollowUpAt,
        createdAt: detail.createdAt,
      };
    }).filter((row) => {
      const q = keyword.trim();
      const matchPhone = !q || formatPhone(row.lead.phone).includes(q);
      const matchLevel = levelFilter === "all" || row.level === levelFilter;
      const matchModel = modelFilter === "all" || row.intentModel === modelFilter;
      const matchNext =
        !nextFollowDate || formatDateKey(row.nextFollowUpAt) === nextFollowDate;
      const matchCreated =
        !createdDate || formatDateKey(row.createdAt) === createdDate;
      return matchPhone && matchLevel && matchModel && matchNext && matchCreated;
    });
  }, [keyword, levelFilter, modelFilter, nextFollowDate, createdDate]);

  React.useEffect(() => {
    setPage(1);
  }, [keyword, levelFilter, modelFilter, nextFollowDate, createdDate]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = React.useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, currentPage]);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-5">
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="手机号搜索"
        />
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value as LevelFilter)}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs",
            "focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
          )}
        >
          <option value="all">客户等级：全部</option>
          <option value="H级">H级</option>
          <option value="A级">A级</option>
          <option value="B级">B级</option>
          <option value="C级">C级</option>
          <option value="N级">N级</option>
        </select>
        <select
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value as ModelFilter)}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs",
            "focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
          )}
        >
          <option value="all">意向车型：全部</option>
          <option value="XC60">XC60</option>
          <option value="XC70">XC70</option>
          <option value="EM90">EM90</option>
          <option value="XC30">XC30</option>
        </select>
        <Input type="date" value={nextFollowDate} onChange={(e) => setNextFollowDate(e.target.value)} />
        <Input type="date" value={createdDate} onChange={(e) => setCreatedDate(e.target.value)} />
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[110px]">姓名</TableHead>
              <TableHead>手机</TableHead>
              <TableHead>客户等级</TableHead>
              <TableHead>意向车型</TableHead>
              <TableHead>下次跟进时间</TableHead>
              <TableHead>线索创建时间</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>归属人</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  暂无匹配线索
                </TableCell>
              </TableRow>
            ) : null}
            {pagedRows.map((row) => (
              <TableRow
                key={row.lead.id}
                className="cursor-pointer"
                onClick={() => openDrawer({ type: "lead", id: row.lead.id })}
              >
                <TableCell className="font-medium">{row.lead.name}</TableCell>
                <TableCell className="font-mono text-sm">{formatPhone(row.lead.phone)}</TableCell>
                <TableCell>{row.level}</TableCell>
                <TableCell>{row.intentModel}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                  {formatDateTime(row.nextFollowUpAt)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                  {formatDateTime(row.createdAt)}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="font-normal">
                    {leadStatusLabel(row.lead.status)}
                  </Badge>
                </TableCell>
                <TableCell>{row.lead.owner}</TableCell>
              </TableRow>
            ))}
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
    </div>
  );
}
