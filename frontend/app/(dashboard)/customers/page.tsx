"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function CustomersPage() {
  const [followUserid, setFollowUserid] = React.useState(DEFAULT_FOLLOW_USERID);
  const [draftFollowUserid, setDraftFollowUserid] = React.useState(DEFAULT_FOLLOW_USERID);
  const [page, setPage] = React.useState(1);
  const pageSize = 15;
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<ListResponse | null>(null);
  const [phones, setPhones] = React.useState<Record<number, string>>({});

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
      const nextPhones: Record<number, string> = {};
      for (const row of list.items) {
        nextPhones[row.id] = row.phone ?? "";
      }
      setPhones((prev) => {
        const merged = { ...prev };
        for (const row of list.items) {
          if (merged[row.id] === undefined) merged[row.id] = row.phone ?? "";
        }
        return merged;
      });
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

  async function savePhone(row: CustomerRow) {
    const val = phones[row.id] ?? "";
    try {
      const r = await fetch("/api/customers/phone", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          follow_userid: row.follow_userid,
          external_userid: row.external_userid,
          phone: val.trim() === "" ? "" : val.trim(),
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
          展示企业微信同步的客户；手机号可在本地维护（不与企微同步覆盖）。
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
                    <TableHead className="min-w-[200px]">手机号</TableHead>
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
                      </TableCell>
                      <TableCell className="hidden max-w-[180px] truncate md:table-cell">
                        {row.corp_full_name || row.corp_name || "—"}
                      </TableCell>
                      <TableCell className="hidden font-mono text-xs lg:table-cell">
                        {row.external_userid}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            className="h-9 min-w-[140px] max-w-[200px]"
                            placeholder="维护手机号"
                            value={phones[row.id] ?? ""}
                            onChange={(e) =>
                              setPhones((p) => ({ ...p, [row.id]: e.target.value }))
                            }
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="shrink-0 gap-1"
                            onClick={() => void savePhone(row)}
                          >
                            <Save className="size-3.5" />
                            保存
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
    </div>
  );
}
