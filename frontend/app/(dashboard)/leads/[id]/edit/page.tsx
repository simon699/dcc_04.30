"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import type { ApiLeadDetail } from "@/components/leads/lead-drawer-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type LeadLevelGrade } from "@/lib/mock-data";
import { cn, formatHttpApiDetail } from "@/lib/utils";

type Level = LeadLevelGrade;

function formatDateTimeInput(dateLike: string): string {
  const d = new Date(dateLike);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

export default function LeadEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const entry = search.get("entry");
  const leadId = params?.id ?? "";

  const [data, setData] = React.useState<ApiLeadDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [intentModel, setIntentModel] = React.useState("");
  const [nextFollow, setNextFollow] = React.useState("");
  const [inviteDate, setInviteDate] = React.useState("");
  const [level, setLevel] = React.useState<Level>("B级");
  const [note, setNote] = React.useState("");
  const [nextFollowMethod, setNextFollowMethod] = React.useState<"phone" | "wecom">(
    "phone"
  );
  const [submitting, setSubmitting] = React.useState(false);

  const load = React.useCallback(() => {
    if (!/^\d+$/.test(leadId)) {
      setData(null);
      setLoadError("无效的线索 ID");
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    fetch(`/api/leads/${encodeURIComponent(leadId)}`)
      .then(async (r) => {
        if (r.status === 404) {
          setData(null);
          setLoadError("未找到该线索");
          return;
        }
        if (!r.ok) {
          const t = await r.text();
          throw new Error(t || r.statusText);
        }
        return r.json() as Promise<ApiLeadDetail>;
      })
      .then((d) => {
        if (!d) return;
        setData(d);
        setIntentModel(d.intent_model ?? "");
        const lv = (d.customer_level ?? "B级") as Level;
        if (["H级", "A级", "B级", "C级", "N级"].includes(lv)) {
          setLevel(lv);
        }
        setNote("");
        if (d.next_follow_up_at) {
          setNextFollow(formatDateTimeInput(d.next_follow_up_at));
        } else {
          setNextFollow("");
        }
        setInviteDate("");
      })
      .catch((e: Error) => {
        setData(null);
        setLoadError(e.message || "加载失败");
      })
      .finally(() => setLoading(false));
  }, [leadId]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初始加载线索
    load();
  }, [load]);

  const displayName = (data?.customer_name ?? "").trim() || "未命名";
  const hasWecom = Boolean((data?.external_userid ?? "").trim());

  React.useEffect(() => {
    if (!data) return;
    if (entry === "phone" && data.phone) {
      toast.message(`已进入电话跟进模式：${displayName}`);
    }
    if (entry === "edit") {
      toast.message(`已进入编辑模式：${displayName}`);
    }
  }, [entry, data, displayName]);

  async function submitCompleteFollow() {
    if (!nextFollow.trim()) {
      toast.error("请填写下次跟进时间");
      return;
    }
    const phOk = Boolean((data.phone ?? "").trim());
    const extOk = Boolean((data.external_userid ?? "").trim());
    if (!phOk && !extOk) {
      toast.error("线索缺少手机号与企微客户 ID，无法生成跟进任务");
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        intent_model: intentModel.trim() || null,
        customer_level: level,
        remark: note.trim() || null,
        invite_store_at: inviteDate.trim() || null,
        next_follow_at: nextFollow.trim(),
        next_follow_method: nextFollowMethod,
      };
      const r = await fetch(`/api/leads/${encodeURIComponent(leadId)}/complete-follow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      let json: unknown;
      try {
        json = await r.json();
      } catch {
        throw new Error(`HTTP ${r.status}`);
      }
      if (!r.ok) throw new Error(formatHttpApiDetail(json));
      toast.success("跟进已保存，并已生成下次跟进任务");
      router.push("/leads");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">编辑线索</h1>
        <p className="text-sm text-muted-foreground">加载中…</p>
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">编辑线索</h1>
        <p className="text-sm text-muted-foreground">{loadError ?? "未找到该线索。"}</p>
        <Button variant="outline" onClick={() => router.push("/leads")}>
          返回线索库
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">编辑线索</h1>
          <p className="mt-1 text-muted-foreground">
            保存后将写入跟进记录，并按下次跟进时间与方式生成一条任务（截止为该日 23:59）。
          </p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          返回
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">客户信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold">{displayName}</span>
            <Badge variant="secondary">
              {data.phone ? data.phone.replace(/^\+86/, "") : "无手机号"}
            </Badge>
            <Badge variant={hasWecom ? "default" : "outline"}>
              {hasWecom ? "已加微" : "未加微"}
            </Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <p>
              <span className="text-muted-foreground">线索产生时间：</span>
              {data.created_at
                ? new Date(data.created_at).toLocaleString("zh-CN")
                : "—"}
            </p>
            <p>
              <span className="text-muted-foreground">当前下次跟进（参考）：</span>
              {data.next_follow_up_at
                ? new Date(data.next_follow_up_at).toLocaleString("zh-CN")
                : "—"}
            </p>
            <p>
              <span className="text-muted-foreground">归属人：</span>
              {data.owner_userid ?? "—"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">客户跟进信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="intentModel">意向车型</Label>
              <Input
                id="intentModel"
                value={intentModel}
                onChange={(e) => setIntentModel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inviteDate">邀约到店日期（选填，可清空）</Label>
              <Input
                id="inviteDate"
                type="date"
                value={inviteDate}
                onChange={(e) => setInviteDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nextFollow">
                下次跟进时间 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nextFollow"
                type="datetime-local"
                value={nextFollow}
                onChange={(e) => setNextFollow(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>下次跟进方式</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={nextFollowMethod === "phone" ? "default" : "outline"}
                  onClick={() => setNextFollowMethod("phone")}
                  className={cn(nextFollowMethod !== "phone" && "border-dashed")}
                >
                  电话
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={nextFollowMethod === "wecom" ? "default" : "outline"}
                  onClick={() => setNextFollowMethod("wecom")}
                  className={cn(nextFollowMethod !== "wecom" && "border-dashed")}
                >
                  微信
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                将写入跟进表，并用于生成任务的触达方式（电话 / 企微）。
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>客户等级</Label>
            <div className="flex flex-wrap gap-2">
              {(["H级", "A级", "B级", "C级", "N级"] as Level[]).map((lv) => (
                <Button
                  key={lv}
                  type="button"
                  size="sm"
                  variant={level === lv ? "default" : "outline"}
                  onClick={() => setLevel(lv)}
                >
                  {lv}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">备注信息</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder="本次跟进内容（写入跟进记录备注）"
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => router.push("/leads")}>
              返回线索库
            </Button>
            <Button
              disabled={submitting || !nextFollow.trim()}
              onClick={() => void submitCompleteFollow()}
            >
              {submitting ? "提交中…" : "保存并完成跟进"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
