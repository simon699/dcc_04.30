"use client";

import * as React from "react";
import { CloudSync } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatHttpApiDetail } from "@/lib/utils";

type WecomSyncResponse = {
  ok?: boolean;
  result?: Record<string, unknown>;
  detail?: unknown;
};

export default function RulesPage() {
  const [syncLoading, setSyncLoading] = React.useState(false);
  const [syncResult, setSyncResult] = React.useState<WecomSyncResponse | null>(null);
  const [syncError, setSyncError] = React.useState<string | null>(null);

  async function handleWecomCustomerSync() {
    setSyncLoading(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      const r = await fetch("/api/wecom/sync/customers", { method: "POST" });
      let data: WecomSyncResponse;
      try {
        data = (await r.json()) as WecomSyncResponse;
      } catch {
        throw new Error(`响应不是 JSON（HTTP ${r.status}）`);
      }
      if (!r.ok) {
        const msg = formatHttpApiDetail(data) || `HTTP ${r.status}`;
        throw new Error(msg);
      }
      setSyncResult(data);
      toast.success("企业微信客户同步已完成");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSyncError(msg);
      toast.error(msg);
    } finally {
      setSyncLoading(false);
    }
  }

  const stats = syncResult?.ok && syncResult.result ? syncResult.result : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">设置</h1>
        <p className="mt-1 text-muted-foreground">
          管理企业微信客户同步等配置。
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CloudSync className="size-5 text-muted-foreground" />
            <CardTitle>企业微信客户同步</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            从企业微信拉取「客户联系」跟进成员与客户详情并写入服务端数据库。耗时因客户量而异，请勿重复点击。
          </p>
          <Button
            type="button"
            onClick={() => void handleWecomCustomerSync()}
            disabled={syncLoading}
            className="gap-2"
          >
            <CloudSync className={`size-4 ${syncLoading ? "animate-pulse" : ""}`} aria-hidden />
            {syncLoading ? "同步中…" : "立即同步"}
          </Button>

          {syncError ? (
            <div
              className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive whitespace-pre-wrap"
              role="alert"
            >
              {syncError}
            </div>
          ) : null}

          {stats ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">本次同步结果</p>
              <ul className="grid gap-1 text-sm sm:max-w-lg">
                <li className="flex justify-between gap-4 border-b border-border/60 py-1">
                  <span className="text-muted-foreground">跟进成员数</span>
                  <span className="font-mono tabular-nums">
                    {String(stats.follow_users_count ?? "—")}
                  </span>
                </li>
                <li className="flex justify-between gap-4 border-b border-border/60 py-1">
                  <span className="text-muted-foreground">成员行写入</span>
                  <span className="font-mono tabular-nums">
                    {String(stats.follow_users_upserted ?? "—")}
                  </span>
                </li>
                <li className="flex justify-between gap-4 border-b border-border/60 py-1">
                  <span className="text-muted-foreground">外部客户（去重）</span>
                  <span className="font-mono tabular-nums">
                    {String(stats.external_customer_distinct ?? "—")}
                  </span>
                </li>
                <li className="flex justify-between gap-4 border-b border-border/60 py-1">
                  <span className="text-muted-foreground">跟进关系写入</span>
                  <span className="font-mono tabular-nums">
                    {String(stats.follow_relations_upserted ?? "—")}
                  </span>
                </li>
                <li className="flex justify-between gap-4 border-b border-border/60 py-1">
                  <span className="text-muted-foreground">详情行数（API）</span>
                  <span className="font-mono tabular-nums">
                    {String(stats.detail_rows_from_api ?? "—")}
                  </span>
                </li>
                <li className="flex justify-between gap-4 py-1">
                  <span className="text-muted-foreground">完成时间</span>
                  <span className="font-mono text-xs break-all text-right">
                    {String(stats.finished_at ?? "—")}
                  </span>
                </li>
              </ul>
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  原始 JSON
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted p-3 font-mono leading-relaxed">
                  {JSON.stringify(syncResult, null, 2)}
                </pre>
              </details>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
