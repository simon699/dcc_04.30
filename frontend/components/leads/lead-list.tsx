"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";

import { leadStatusLabel } from "@/lib/mock-data";
import { useUiStore } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";

import {
  ASSIGNABLE_OWNER_USERIDS,
  DEFAULT_LEAD_OWNER_USERID,
} from "./lead-drawer-panel";

type LevelFilter = "all" | "H级" | "A级" | "B级" | "C级" | "N级";
type ModelFilter = "all" | "XC60" | "XC70" | "EM90" | "XC30";

type ApiLeadRow = {
  id: string;
  phone: string | null;
  customer_name: string | null;
  created_at: string | null;
  intent_model: string | null;
  customer_level: string | null;
  owner_userid: string | null;
  next_follow_up_at: string | null;
  status: string;
};

const PAGE_SIZE = 8;

function formatPhone(phone?: string | null): string {
  const raw = (phone ?? "").trim();
  if (!raw) return "—";
  if (raw.startsWith("+86")) return raw.slice(3);
  return raw;
}

function formatDateTime(v: string | null | undefined): string {
  if (!v) return "—";
  return new Date(v).toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildListUrl(
  page: number,
  keyword: string,
  levelFilter: LevelFilter,
  modelFilter: ModelFilter,
  nextFollowDate: string,
  createdDate: string
): string {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("page_size", String(PAGE_SIZE));
  const q = keyword.trim();
  if (q) params.set("keyword", q);
  if (levelFilter !== "all") params.set("customer_level", levelFilter);
  if (modelFilter !== "all") params.set("intent_model", modelFilter);
  if (nextFollowDate) params.set("next_follow_date", nextFollowDate);
  if (createdDate) params.set("created_date", createdDate);
  return `/api/leads?${params.toString()}`;
}

export function LeadList() {
  const openDrawer = useUiStore((s) => s.openDrawer);

  const [keyword, setKeyword] = React.useState("");
  const [levelFilter, setLevelFilter] = React.useState<LevelFilter>("all");
  const [modelFilter, setModelFilter] = React.useState<ModelFilter>("all");
  const [nextFollowDate, setNextFollowDate] = React.useState("");
  const [createdDate, setCreatedDate] = React.useState("");
  const [page, setPage] = React.useState(1);

  const [items, setItems] = React.useState<ApiLeadRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [listError, setListError] = React.useState<string | null>(null);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [createPhone, setCreatePhone] = React.useState("");
  const [createName, setCreateName] = React.useState("");
  const [createIntent, setCreateIntent] = React.useState("");
  const [createLevel, setCreateLevel] = React.useState<
    "H级" | "A级" | "B级" | "C级" | "N级"
  >("B级");
  const [creating, setCreating] = React.useState(false);

  const [assignOpen, setAssignOpen] = React.useState(false);
  const [assignLeadId, setAssignLeadId] = React.useState<string | null>(null);
  const [selectedOwner, setSelectedOwner] = React.useState("");
  const [assigning, setAssigning] = React.useState(false);

  const loadList = React.useCallback(() => {
    setLoading(true);
    setListError(null);
    const url = buildListUrl(
      page,
      keyword,
      levelFilter,
      modelFilter,
      nextFollowDate,
      createdDate
    );
    fetch(url)
      .then(async (r) => {
        if (!r.ok) {
          const t = await r.text();
          throw new Error(t || `HTTP ${r.status}`);
        }
        return r.json() as Promise<{
          items: ApiLeadRow[];
          total: number;
          total_pages: number;
        }>;
      })
      .then((data) => {
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
      })
      .catch((e: Error) => {
        setItems([]);
        setTotal(0);
        setListError(e.message || "加载失败");
      })
      .finally(() => setLoading(false));
  }, [page, keyword, levelFilter, modelFilter, nextFollowDate, createdDate]);

  React.useEffect(() => {
    loadList();
  }, [loadList]);

  React.useEffect(() => {
    setPage(1);
  }, [keyword, levelFilter, modelFilter, nextFollowDate, createdDate]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE) || 1);
  const currentPage = Math.min(page, pageCount);
  const assignRow = items.find((r) => r.id === assignLeadId);

  function openAssign(leadId: string) {
    setAssignLeadId(leadId);
    setAssignOpen(true);
    setSelectedOwner("");
  }

  function submitCreate() {
    const phone = createPhone.trim();
    if (!phone) return;
    setCreating(true);
    fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone,
        customer_name: createName.trim(),
        intent_model: createIntent.trim() || null,
        customer_level: createLevel,
        owner_userid: DEFAULT_LEAD_OWNER_USERID,
      }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const t = await r.text();
          throw new Error(t || r.statusText);
        }
        return r.json();
      })
      .then(() => {
        setListError(null);
        toast.success("线索已创建");
        setCreateOpen(false);
        setCreatePhone("");
        setCreateName("");
        setCreateIntent("");
        setCreateLevel("B级");
        loadList();
      })
      .catch((e: Error) => {
        setListError(e.message || "创建失败");
      })
      .finally(() => setCreating(false));
  }

  function submitAssign() {
    if (!assignLeadId || !selectedOwner) return;
    setAssigning(true);
    fetch(`/api/leads/${encodeURIComponent(assignLeadId)}/owner`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner_userid: selectedOwner }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const t = await r.text();
          throw new Error(t || r.statusText);
        }
        setListError(null);
        toast.success("归属人已更新");
        setAssignOpen(false);
        loadList();
      })
      .catch((e: Error) => {
        setListError(e.message || "分配失败");
      })
      .finally(() => setAssigning(false));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid flex-1 gap-2 sm:grid-cols-5">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="手机号、姓名"
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
          <Input
            type="date"
            value={nextFollowDate}
            onChange={(e) => setNextFollowDate(e.target.value)}
          />
          <Input
            type="date"
            value={createdDate}
            onChange={(e) => setCreatedDate(e.target.value)}
          />
        </div>
        <Button type="button" className="shrink-0" onClick={() => setCreateOpen(true)}>
          新建线索
        </Button>
      </div>

      {listError ? (
        <p className="text-sm text-destructive">{listError}</p>
      ) : null}

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
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                  加载中…
                </TableCell>
              </TableRow>
            ) : null}
            {!loading && items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                  暂无匹配线索
                </TableCell>
              </TableRow>
            ) : null}
            {!loading
              ? items.map((row) => {
                  const displayName =
                    (row.customer_name ?? "").trim() || "未命名";
                  const st = row.status as "new" | "following";
                  return (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() => openDrawer({ type: "lead", id: row.id })}
                    >
                      <TableCell className="font-medium">{displayName}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatPhone(row.phone)}
                      </TableCell>
                      <TableCell>{row.customer_level ?? "—"}</TableCell>
                      <TableCell>{row.intent_model ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                        {formatDateTime(row.next_follow_up_at)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                        {formatDateTime(row.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          {leadStatusLabel(st)}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.owner_userid ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAssign(row.id);
                          }}
                        >
                          分配
                        </Button>
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

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>新建线索</SheetTitle>
            <SheetDescription>
              默认归属人：{DEFAULT_LEAD_OWNER_USERID}（与后端一致）
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1">
            <div className="space-y-2">
              <Label htmlFor="create-phone">手机号 *</Label>
              <Input
                id="create-phone"
                value={createPhone}
                onChange={(e) => setCreatePhone(e.target.value)}
                placeholder="必填"
                autoComplete="tel"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-name">客户姓名</Label>
              <Input
                id="create-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-intent">意向车型</Label>
              <Input
                id="create-intent"
                value={createIntent}
                onChange={(e) => setCreateIntent(e.target.value)}
                placeholder="可填写如 XC60"
              />
            </div>
            <div className="space-y-2">
              <Label>客户等级</Label>
              <select
                value={createLevel}
                onChange={(e) =>
                  setCreateLevel(
                    e.target.value as "H级" | "A级" | "B级" | "C级" | "N级"
                  )
                }
                className={cn(
                  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs",
                  "focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                )}
              >
                <option value="H级">H级</option>
                <option value="A级">A级</option>
                <option value="B级">B级</option>
                <option value="C级">C级</option>
                <option value="N级">N级</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>默认归属人</Label>
              <Input readOnly value={DEFAULT_LEAD_OWNER_USERID} className="bg-muted/50" />
            </div>
            <div className="mt-auto flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setCreateOpen(false)}
              >
                取消
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={!createPhone.trim() || creating}
                onClick={submitCreate}
              >
                {creating ? "提交中…" : "创建"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>分配线索</DialogTitle>
            <DialogDescription>
              为 {(assignRow?.customer_name ?? "").trim() || "当前客户"}{" "}
              选择归属人
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">归属人（userid）</label>
            <select
              value={selectedOwner}
              onChange={(e) => setSelectedOwner(e.target.value)}
              className={cn(
                "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs",
                "focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
              )}
            >
              <option value="">请选择人员</option>
              {ASSIGNABLE_OWNER_USERIDS.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              取消
            </Button>
            <Button
              disabled={!selectedOwner || assigning}
              onClick={submitAssign}
            >
              {assigning ? "提交中…" : "确认转交"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
