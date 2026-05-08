"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Button as AntButton,
  DatePicker,
  Input as AntInput,
  InputNumber,
  Modal,
  Radio,
  Select,
  Segmented,
  Space,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/zh-cn";
import { toast } from "sonner";

import {
  DEFAULT_LEAD_OWNER_USERID,
  type ApiLeadDetail,
} from "@/components/leads/lead-drawer-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { type LeadLevelGrade } from "@/lib/mock-data";
import { formatCnWallClockApi } from "@/lib/datetime-cn";
import { formatHttpApiDetail } from "@/lib/utils";

dayjs.locale("zh-cn");

type Level = LeadLevelGrade;

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
  const [nextFollowAt, setNextFollowAt] = React.useState<Dayjs | null>(null);
  const [inviteStoreDay, setInviteStoreDay] = React.useState<Dayjs | null>(null);
  const [level, setLevel] = React.useState<Level>("B级");
  const [note, setNote] = React.useState("");
  const [nextFollowMethod, setNextFollowMethod] = React.useState<"phone" | "wecom">(
    "phone"
  );
  const [phoneSupplement, setPhoneSupplement] = React.useState("");
  const [callDurationSec, setCallDurationSec] = React.useState<number | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
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
        setCallDurationSec(null);
        const sp = (d.phone ?? "").trim();
        const ext = (d.external_userid ?? "").trim();
        setNextFollowMethod(sp ? "phone" : ext ? "wecom" : "wecom");
        if (d.next_follow_up_at) {
          const nx = dayjs(d.next_follow_up_at);
          setNextFollowAt(nx.isValid() ? nx : dayjs().add(1, "day").hour(10).minute(0).second(0));
        } else {
          setNextFollowAt(dayjs().add(1, "day").hour(10).minute(0).second(0));
        }
        const invStr = inviteFromLatestRemark(d.follows);
        const invParsed = invStr ? dayjs(invStr, "YYYY-MM-DD", true) : null;
        setInviteStoreDay(invParsed?.isValid() ? invParsed : null);
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
    if (!nextFollowAt || !nextFollowAt.isValid()) {
      return "请选择有效的下次跟进时间";
    }
    if (inviteStoreDay != null && !inviteStoreDay.isValid()) {
      return "邀约到店日期无效，请清空或重选";
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
    nextFollowAt,
    inviteStoreDay,
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
    if (!nextFollowAt?.isValid()) {
      toast.error("请选择下次跟进时间");
      return;
    }
    if (nextFollowMethod === "phone" && !canUsePhoneFollow) {
      toast.error("电话跟进请先在客户信息中填写手机号");
      return;
    }
    let callDurationSeconds: number | undefined;
    if (nextFollowMethod === "phone" && callDurationSec != null && callDurationSec >= 0) {
      callDurationSeconds = Math.floor(callDurationSec);
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        intent_model: intentModel.trim() || null,
        customer_level: level,
        remark: note.trim() || null,
        invite_store_at:
          inviteStoreDay?.isValid() ? inviteStoreDay.format("YYYY-MM-DD") : null,
        next_follow_at: formatCnWallClockApi(nextFollowAt),
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
              <AntInput
                id="phoneSupplement"
                value={phoneSupplement}
                onChange={(e) => setPhoneSupplement(e.target.value)}
                placeholder="无主档手机号时可填写，提交跟进时将写入线索"
                autoComplete="tel"
                className="max-w-md"
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
              <Space wrap>
                <AntButton
                  onClick={() => {
                    setCustomerPickerOpen(true);
                    void loadCustomerOptions();
                  }}
                >
                  {linkCustomerLabel.trim()
                    ? `已选：${linkCustomerLabel.trim()}`
                    : "选择客户…"}
                </AntButton>
                {linkExternalUserid.trim() ? (
                  <AntButton
                    type="link"
                    onClick={() => {
                      setLinkExternalUserid("");
                      setLinkCustomerLabel("");
                    }}
                  >
                    清除关联
                  </AntButton>
                ) : null}
              </Space>
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
              <AntInput
                id="intentModel"
                value={intentModel}
                onChange={(e) => setIntentModel(e.target.value)}
                className="w-full max-w-md"
              />
            </div>
            <div className="space-y-2">
              <Label>邀约到店日期（选填）</Label>
              <DatePicker
                value={inviteStoreDay}
                onChange={(v) => setInviteStoreDay(v)}
                format="YYYY-MM-DD"
                allowClear
                className="w-full max-w-xs"
                placeholder="选择日期"
              />
              <p className="text-xs text-muted-foreground">
                使用 Ant Design 日期选择器，支持一键清空。
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>
                下次跟进时间 <span className="text-destructive">*</span>
              </Label>
              <DatePicker
                showTime
                value={nextFollowAt}
                onChange={(v) => setNextFollowAt(v)}
                format="YYYY-MM-DD HH:mm"
                allowClear={false}
                className="w-full max-w-xs"
                needConfirm={false}
              />
              <p className="text-xs text-muted-foreground">
                日期 + 时间一体化选择（Ant Design）。
              </p>
            </div>
            <div className="space-y-2">
              <Label>下次跟进方式</Label>
              <Radio.Group
                value={nextFollowMethod}
                onChange={(e) =>
                  setNextFollowMethod(e.target.value as "phone" | "wecom")
                }
              >
                <Radio.Button value="phone" disabled={!canUsePhoneFollow}>
                  电话
                </Radio.Button>
                <Radio.Button value="wecom">微信</Radio.Button>
              </Radio.Group>
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
              <InputNumber
                id="callDurationSec"
                min={0}
                max={86400}
                value={callDurationSec ?? undefined}
                onChange={(v) => setCallDurationSec(typeof v === "number" ? v : null)}
                placeholder="例如 180"
                className="max-w-xs"
              />
              <p className="text-xs text-muted-foreground">
                将写入跟进记录并展示在工作台「通话记录」中。
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>客户等级</Label>
            <Segmented<Level>
              options={["H级", "A级", "B级", "C级", "N级"]}
              value={level}
              onChange={(v) => setLevel(v)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">备注信息</Label>
            <AntInput.TextArea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder="本次跟进内容（写入跟进记录备注）"
              className="max-w-2xl"
            />
          </div>

          <div className="flex flex-col items-end gap-2">
            {saveBlockedReason ? (
              <p className="max-w-md text-right text-xs text-muted-foreground">
                按钮不可用原因：{saveBlockedReason}
              </p>
            ) : null}
            <Space wrap>
              <AntButton onClick={() => router.push("/leads")}>返回线索库</AntButton>
              <AntButton
                type="primary"
                disabled={submitting || Boolean(saveBlockedReason)}
                title={saveBlockedReason ?? undefined}
                loading={submitting}
                onClick={() => void submitCompleteFollow()}
              >
                保存并完成跟进
              </AntButton>
            </Space>
          </div>
        </CardContent>
      </Card>

      <Modal
        title="选择企微客户"
        open={customerPickerOpen}
        onCancel={() => setCustomerPickerOpen(false)}
        footer={null}
        destroyOnClose
      >
        <p className="mb-3 text-sm text-muted-foreground">
          搜索昵称、备注或外部联系人 ID；选定后将关联到当前线索。
        </p>
        <Select
          showSearch
          allowClear
          loading={loadingCustomerOptions}
          placeholder="请选择客户"
          style={{ width: "100%" }}
          options={customerOptions.map((o) => ({
            value: o.external_userid,
            label: `${o.label} (${o.external_userid})`,
          }))}
          filterOption={(input, option) =>
            (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
          }
          onChange={(v) => {
            if (!v) return;
            const o = customerOptions.find((x) => x.external_userid === v);
            setLinkExternalUserid(v);
            setLinkCustomerLabel(o?.label ?? v);
            setCustomerPickerOpen(false);
          }}
        />
      </Modal>
    </div>
  );
}
