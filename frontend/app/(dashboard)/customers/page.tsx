"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { toast } from "sonner";

import {
  CreateLeadSheet,
  type CreateLeadPrefill,
} from "@/components/leads/create-lead-sheet";
import {
  CreateWecomTaskSheet,
  type CreateWecomTaskPrefill,
} from "@/components/tasks/create-wecom-task-sheet";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatHttpApiDetail } from "@/lib/utils";

const DEFAULT_FOLLOW_USERID = "ShiFengwei";

type CustomerRow = {
  id: number;
  follow_userid: string;
  external_userid: string;
  remark: string | null;
  phone: string | null;
  createtime: number | null;
  name: string | null;
  avatar: string | null;
  corp_name: string | null;
  corp_full_name: string | null;
  type: number | null;
  position: string | null;
};

type ListResponse = {
  items: CustomerRow[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  follow_userid: string;
};

function displayName(row: CustomerRow): string {
  return row.remark?.trim() || row.name?.trim() || row.external_userid;
}

function displayPhonePreview(p: string | null | undefined): string {
  const t = (p ?? "").trim();
  return t || "—";
}

export default function CustomersPage() {
  const [followUserid, setFollowUserid] = React.useState(DEFAULT_FOLLOW_USERID);
  const [draftFollowUserid, setDraftFollowUserid] = React.useState(DEFAULT_FOLLOW_USERID);
  const [page, setPage] = React.useState(1);
  const pageSize = 15;
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<ListResponse | null>(null);
  const [createLeadOpen, setCreateLeadOpen] = React.useState(false);
  const [createLeadPrefill, setCreateLeadPrefill] = React.useState<CreateLeadPrefill>({});
  const [taskSheetOpen, setTaskSheetOpen] = React.useState(false);
  const [taskPrefill, setTaskPrefill] = React.useState<CreateWecomTaskPrefill>({});

  const [editRow, setEditRow] = React.useState<CustomerRow | null>(null);
  const [editPhone, setEditPhone] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        follow_userid: followUserid.trim() || DEFAULT_FOLLOW_USERID,
        page: String(page),
        page_size: String(pageSize),
      });
      const r = await fetch(`/api/customers?${q}`);
      let json: unknown;
      try {
        json = await r.json();
      } catch {
        throw new Error(`接口返回非 JSON（HTTP ${r.status}）`);
      }
      if (!r.ok) {
        throw new Error(formatHttpApiDetail(json));
      }
      const list = json as ListResponse;
      setData(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [followUserid, page]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function openEdit(row: CustomerRow) {
    setEditRow(row);
    setEditPhone(row.phone ?? "");
  }

  async function saveEditPhone() {
    if (!editRow) return;
    try {
      const r = await fetch("/api/customers/phone", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          follow_userid: editRow.follow_userid,
          external_userid: editRow.external_userid,
          phone: editPhone.trim() === "" ? "" : editPhone.trim(),
        }),
      });
      let json: unknown;
      try {
        json = await r.json();
      } catch {
        throw new Error(`HTTP ${r.status}`);
      }
      if (!r.ok) throw new Error(formatHttpApiDetail(json));
      toast.success("手机号已保存");
      setEditRow(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  function applyFollowFilter() {
    setFollowUserid(draftFollowUserid.trim() || DEFAULT_FOLLOW_USERID);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">客户中心</h1>
        <p className="mt-1 text-muted-foreground">
          展示企业微信同步的客户；手机号在「编辑」中维护（本地保存，不与企微同步覆盖）。
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">筛选</CardTitle>
          <CardDescription>默认跟进人：{DEFAULT_FOLLOW_USERID}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="follow-userid">跟进成员 userid</Label>
            <Input
              id="follow-userid"
              value={draftFollowUserid}
              onChange={(e) => setDraftFollowUserid(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFollowFilter()}
              className="w-[220px]"
              placeholder={DEFAULT_FOLLOW_USERID}
            />
          </div>
          <Button type="button" variant="secondary" onClick={applyFollowFilter}>
            查询
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setCreateLeadPrefill({});
              setCreateLeadOpen(true);
            }}
          >
            创建线索
          </Button>
          <Button
            type="button"
            onClick={() => {
              setTaskPrefill({});
              setTaskSheetOpen(true);
            }}
          >
            创建任务
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 pt-4">
          {loading ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">加载中…</p>
          ) : !data || data.items.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              暂无数据。请先在「设置」中执行企业微信同步，或调整跟进成员。
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[72px]">头像</TableHead>
                    <TableHead>昵称 / 备注</TableHead>
                    <TableHead className="hidden md:table-cell">公司</TableHead>
                    <TableHead className="hidden lg:table-cell">客户 ID</TableHead>
                    <TableHead className="hidden sm:table-cell">手机号</TableHead>
                    <TableHead className="w-[200px] text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        {row.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.avatar}
                            alt=""
                            className="size-10 rounded-full bg-muted object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="flex size-10 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                            —
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{displayName(row)}</div>
                        {row.name && row.remark ? (
                          <div className="text-xs text-muted-foreground">昵称：{row.name}</div>
                        ) : null}
                        {row.position ? (
                          <div className="text-xs text-muted-foreground">{row.position}</div>
                        ) : null}
                        <div className="mt-1 text-xs text-muted-foreground sm:hidden">
                          手机：{displayPhonePreview(row.phone)}
                        </div>
                      </TableCell>
                      <TableCell className="hidden max-w-[180px] truncate md:table-cell">
                        {row.corp_full_name || row.corp_name || "—"}
                      </TableCell>
                      <TableCell className="hidden font-mono text-xs lg:table-cell">
                        {row.external_userid}
                      </TableCell>
                      <TableCell className="hidden font-mono text-sm sm:table-cell">
                        {displayPhonePreview(row.phone)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => openEdit(row)}
                          >
                            <Pencil className="size-3.5" />
                            编辑
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setCreateLeadPrefill({
                                phone: (row.phone ?? "").trim(),
                                external_userid: row.external_userid,
                                customer_name: displayName(row),
                              });
                              setCreateLeadOpen(true);
                            }}
                          >
                            创建线索
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              const ph = (row.phone ?? "").trim();
                              setTaskPrefill({
                                targets: [
                                  {
                                    target_external_userid: row.external_userid,
                                    ...(ph ? { target_phone: ph } : {}),
                                  },
                                ],
                              });
                              setTaskSheetOpen(true);
                            }}
                          >
                            创建任务
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
                <span className="text-muted-foreground">
                  共 {data.total} 条 · 第 {data.page} / {Math.max(data.total_pages, 1)} 页
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="size-4" />
                    上一页
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= (data.total_pages || 1)}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    下一页
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={editRow !== null} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑客户</DialogTitle>
            <DialogDescription>
              {editRow ? (
                <>
                  {displayName(editRow)}
                  <span className="mt-1 block font-mono text-xs text-muted-foreground">
                    {editRow.external_userid}
                  </span>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-2">
              <Label htmlFor="edit-phone">维护手机号</Label>
              <Input
                id="edit-phone"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="本地保存，可留空"
                autoComplete="tel"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>
              取消
            </Button>
            <Button onClick={() => void saveEditPhone()}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateLeadSheet
        open={createLeadOpen}
        onOpenChange={setCreateLeadOpen}
        prefill={createLeadPrefill}
        onSuccess={() => void load()}
        formId="customers-center"
      />

      <CreateWecomTaskSheet
        open={taskSheetOpen}
        onOpenChange={setTaskSheetOpen}
        prefill={taskPrefill}
        onSuccess={() => void load()}
        formId="customers-task"
      />
    </div>
  );
}
