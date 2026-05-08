"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import {
  DEFAULT_LEAD_OWNER_USERID,
  type ApiLeadDetail,
} from "@/components/leads/lead-drawer-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type LeadLevelGrade } from "@/lib/mock-data";
import { cn, formatHttpApiDetail } from "@/lib/utils";

type Level = LeadLevelGrade;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_HM_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

type CustomerOptionRow = {
  external_userid: string;
  label: string;
  phone: string | null;
};

function inviteFromLatestRemark(
  follows: ApiLeadDetail["follows"] | undefined
): string {
  const r = follows?.[0]?.remark;
  if (!r) return "";
  const m = r.match(/邀约到店[：:]\s*(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? "";
}

function splitLocalDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "10:00" };
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return { date: `${y}-${m}-${day}`, time: `${hh}:${mm}` };
}

function defaultNextFollowParts(): { date: string; time: string } {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return { date: `${y}-${m}-${day}`, time: "10:00" };
}

function buildNextFollowIso(dateRaw: string, timeRaw: string): string {
  const date = dateRaw.trim();
  const time = timeRaw.trim() || "10:00";
  const [hh = "10", mm = "00"] = time.split(":");
  const h = hh.padStart(2, "0").slice(-2);
  const mi = mm.padStart(2, "0").slice(-2);
  return `${date}T${h}:${mi}:00`;
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
  const [nextFollowDate, setNextFollowDate] = React.useState("");
  const [nextFollowTime, setNextFollowTime] = React.useState("10:00");
  const [inviteDate, setInviteDate] = React.useState("");
  const [level, setLevel] = React.useState<Level>("B级");
  const [note, setNote] = React.useState("");
  const [nextFollowMethod, setNextFollowMethod] = React.useState<"phone" | "wecom">(
    "phone"
  );
  /** 线索无主档手机号时，保存跟进前可在此填写 */
  const [phoneSupplement, setPhoneSupplement] = React.useState("");
  /** 电话跟进时可选，单位：秒 */
  const [callDurationSec, setCallDurationSec] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  /** 未加微时：用户选择的企微客户 */
  const [linkExternalUserid, setLinkExternalUserid] = React.useState("");
  const [linkCustomerLabel, setLinkCustomerLabel] = React.useState("");
  const [customerPickerOpen, setCustomerPickerOpen] = React.useState(false);
  const [customerOptions, setCustomerOptions] = React.useState<CustomerOptionRow[]>(
    []
  );
  const [loadingCustomerOptions, setLoadingCustomerOptions] = React.useState(false);

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
        setPhoneSupplement("");
        setCallDurationSec("");
        const sp = (d.phone ?? "").trim();
        const ext = (d.external_userid ?? "").trim();
        setNextFollowMethod(sp ? "phone" : ext ? "wecom" : "wecom");
        if (d.next_follow_up_at) {
          const parts = splitLocalDateTime(d.next_follow_up_at);
          setNextFollowDate(parts.date);
          setNextFollowTime(parts.time);
        } else {
          const def = defaultNextFollowParts();
          setNextFollowDate(def.date);
          setNextFollowTime(def.time);
        }
        setInviteDate(inviteFromLatestRemark(d.follows));
        setLinkExternalUserid("");
        setLinkCustomerLabel("");
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
  const hasWecomOnLead = Boolean((data?.external_userid ?? "").trim());
  const storedPhoneStr = (data?.phone ?? "").trim();
  const effectivePhone = storedPhoneStr || phoneSupplement.trim();
  const effectiveExternalUserid =
    (data?.external_userid ?? "").trim() || linkExternalUserid.trim();
  const canUsePhoneFollow = Boolean(effectivePhone);

  const saveBlockedReason = React.useMemo(() => {
    if (!data) return "线索未加载";
    const d = nextFollowDate.trim();
    const t = nextFollowTime.trim();
    if (!d || !ISO_DATE_RE.test(d)) {
      return "请填写有效的跟进日期（YYYY-MM-DD）";
    }
    if (!t || !TIME_HM_RE.test(t)) {
      return "请填写有效时间（HH:mm，24 小时制）";
    }
    const inv = inviteDate.trim();
    if (inv && !ISO_DATE_RE.test(inv)) {
      return "邀约到店须为 YYYY-MM-DD 或清空";
    }
    if (!effectivePhone && !effectiveExternalUserid) {
      return "须填写手机号或关联企微客户后才能保存并完成跟进";
    }
    if (nextFollowMethod === "phone" && !canUsePhoneFollow) {
      return "电话跟进需要先填写手机号";
    }
    return null;
  }, [
    data,
    nextFollowDate,
    nextFollowTime,
    inviteDate,
    effectivePhone,
    effectiveExternalUserid,
    nextFollowMethod,
    canUsePhoneFollow,
  ]);

  const loadCustomerOptions = React.useCallback(async () => {
    const fu =
      (data?.owner_userid ?? "").trim() || DEFAULT_LEAD_OWNER_USERID;
    setLoadingCustomerOptions(true);
    try {
      const r = await fetch(
        `/api/customers/options?follow_userid=${encodeURIComponent(fu)}&limit=500`
      );
      if (!r.ok) {
        const tx = await r.text();
        throw new Error(tx || r.statusText);
      }
      const json = (await r.json()) as { items?: CustomerOptionRow[] };
      setCustomerOptions(Array.isArray(json.items) ? json.items : []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
      setCustomerOptions([]);
    } finally {
      setLoadingCustomerOptions(false);
    }
  }, [data?.owner_userid]);

  React.useEffect(() => {
    if (!data) return;
    if (entry === "phone" && data.phone) {
      toast.message(`已进入电话跟进模式：${displayName}`);
    }
    if (entry === "edit") {
      toast.message(`已进入编辑模式：${displayName}`);
    }
  }, [entry, data, displayName]);

  React.useEffect(() => {
    if (nextFollowMethod === "phone" && !canUsePhoneFollow) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 无手机号时不能停留在「电话」方式
      setNextFollowMethod("wecom");
    }
  }, [nextFollowMethod, canUsePhoneFollow]);

  async function submitCompleteFollow() {
    if (!data) {
      toast.error("线索数据未加载");
      return;
    }
    if (saveBlockedReason) {
      toast.error(saveBlockedReason);
      return;
    }
    const nextIso = buildNextFollowIso(nextFollowDate, nextFollowTime);
    if (nextFollowMethod === "phone" && !canUsePhoneFollow) {
      toast.error("电话跟进请先在客户信息中填写手机号");
      return;
    }
    let callDurationSeconds: number | undefined;
    if (nextFollowMethod === "phone" && callDurationSec.trim()) {
      const n = parseInt(callDurationSec.trim(), 10);
      if (Number.isNaN(n) || n < 0) {
        toast.error("通话时长须为有效的非负整数（秒）");
        return;
      }
      callDurationSeconds = n;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        intent_model: intentModel.trim() || null,
        customer_level: level,
        remark: note.trim() || null,
        invite_store_at: inviteDate.trim() || null,
        next_follow_at: nextIso,
        next_follow_method: nextFollowMethod,
      };
      if (!hasWecomOnLead && linkExternalUserid.trim()) {
        body.external_userid = linkExternalUserid.trim();
      }
      if (!storedPhoneStr && phoneSupplement.trim()) {
        body.phone = phoneSupplement.trim();
      }
      if (callDurationSeconds !== undefined) {
        body.call_duration_seconds = callDurationSeconds;
      }
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
              {effectivePhone
                ? effectivePhone.replace(/^\+86/, "")
                : "无手机号"}
            </Badge>
            <Badge variant={hasWecomOnLead ? "default" : "outline"}>
              {hasWecomOnLead ? "已加微" : "未加微"}
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
          {!storedPhoneStr ? (
            <div className="space-y-2 pt-1">
              <Label htmlFor="phoneSupplement">手机号</Label>
              <Input
                id="phoneSupplement"
                value={phoneSupplement}
                onChange={(e) => setPhoneSupplement(e.target.value)}
                placeholder="无主档手机号时可填写，提交跟进时将写入线索"
                autoComplete="tel"
              />
              <p className="text-xs text-muted-foreground">
                填写后方可选择「电话」跟进方式，并用于生成电话任务。
              </p>
            </div>
          ) : null}
          {!hasWecomOnLead ? (
            <div className="space-y-2 rounded-md border border-dashed border-border/80 bg-muted/20 p-3">
              <Label>关联企微客户（未加微时可选项）</Label>
              <p className="text-xs text-muted-foreground">
                从客户库选择外部联系人，提交「保存并完成跟进」时将写入线索并完成关联；任务对象将使用企微 ID。
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCustomerPickerOpen(true);
                    void loadCustomerOptions();
                  }}
                >
                  {linkCustomerLabel.trim()
                    ? `已选：${linkCustomerLabel.trim()}`
                    : "选择客户…"}
                </Button>
                {linkExternalUserid.trim() ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setLinkExternalUserid("");
                      setLinkCustomerLabel("");
                    }}
                  >
                    清除关联
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
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
              <Label htmlFor="inviteDate">邀约到店日期（选填）</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="inviteDate"
                  value={inviteDate}
                  onChange={(e) => setInviteDate(e.target.value)}
                  placeholder="YYYY-MM-DD，留空表示无"
                  autoComplete="off"
                  className="min-w-[11rem] flex-1 font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setInviteDate("")}
                >
                  清空
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                文本输入，可随时清空；不再使用浏览器原生日期控件。
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>
                下次跟进时间 <span className="text-destructive">*</span>
              </Label>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[10rem] flex-1 space-y-1">
                  <span className="text-xs text-muted-foreground">日期</span>
                  <Input
                    id="nextFollowDate"
                    value={nextFollowDate}
                    onChange={(e) => setNextFollowDate(e.target.value)}
                    placeholder="YYYY-MM-DD"
                    autoComplete="off"
                    className="font-mono text-sm"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setNextFollowDate("")}
                >
                  清空日期
                </Button>
                <div className="min-w-[6rem] space-y-1">
                  <span className="text-xs text-muted-foreground">时间</span>
                  <Input
                    id="nextFollowTime"
                    value={nextFollowTime}
                    onChange={(e) => setNextFollowTime(e.target.value)}
                    placeholder="10:00"
                    autoComplete="off"
                    className="font-mono text-sm"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setNextFollowTime("10:00")}
                >
                  默认 10:00
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                日期与时间分开填写，均可单独清空后重填；提交时组合为本地时间的跟进时点。
              </p>
            </div>
            <div className="space-y-2">
              <Label>下次跟进方式</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={nextFollowMethod === "phone" ? "default" : "outline"}
                  onClick={() => setNextFollowMethod("phone")}
                  disabled={!canUsePhoneFollow}
                  title={
                    !canUsePhoneFollow ? "请先填写客户手机号后再选择电话跟进" : undefined
                  }
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
              {!canUsePhoneFollow ? (
                <p className="text-xs text-amber-700 dark:text-amber-500">
                  当前无主档手机号：请先在上方的客户信息中填写手机号，才能选择电话跟进。
                </p>
              ) : null}
            </div>
          </div>

          {nextFollowMethod === "phone" ? (
            <div className="space-y-2">
              <Label htmlFor="callDurationSec">本次通话时长（秒，选填）</Label>
              <Input
                id="callDurationSec"
                inputMode="numeric"
                value={callDurationSec}
                onChange={(e) =>
                  setCallDurationSec(e.target.value.replace(/\D/g, ""))
                }
                placeholder="例如 180"
              />
              <p className="text-xs text-muted-foreground">
                将写入跟进记录并展示在工作台「通话记录」中。
              </p>
            </div>
          ) : null}

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

          <div className="flex flex-col items-end gap-2">
            {saveBlockedReason ? (
              <p className="max-w-md text-right text-xs text-muted-foreground">
                按钮不可用原因：{saveBlockedReason}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => router.push("/leads")}>
                返回线索库
              </Button>
              <Button
                disabled={submitting || Boolean(saveBlockedReason)}
                title={saveBlockedReason ?? undefined}
                onClick={() => void submitCompleteFollow()}
              >
                {submitting ? "提交中…" : "保存并完成跟进"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={customerPickerOpen} onOpenChange={setCustomerPickerOpen}>
        <DialogContent className="gap-0 sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>选择企微客户</DialogTitle>
            <DialogDescription>
              按昵称、备注或外部联系人 ID 搜索；选定后将关联到当前线索。
            </DialogDescription>
          </DialogHeader>
          <Command className="border border-border/60">
            <CommandInput placeholder="搜索…" />
            <CommandList>
              {loadingCustomerOptions ? (
                <CommandEmpty>加载中…</CommandEmpty>
              ) : customerOptions.length === 0 ? (
                <CommandEmpty>暂无客户或未加载成功</CommandEmpty>
              ) : (
                <CommandGroup heading="客户">
                  {customerOptions.map((o) => (
                    <CommandItem
                      key={o.external_userid}
                      value={`${o.label} ${o.external_userid} ${o.phone ?? ""}`}
                      onSelect={() => {
                        setLinkExternalUserid(o.external_userid);
                        setLinkCustomerLabel(o.label);
                        setCustomerPickerOpen(false);
                      }}
                    >
                      <span className="truncate">{o.label}</span>
                      <span className="ml-2 truncate font-mono text-xs text-muted-foreground">
                        {o.external_userid}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </div>
  );
}
