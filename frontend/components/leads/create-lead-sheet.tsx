"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { fetchCustomerOptions, type CustomerOption } from "@/lib/customer-options";
import { asTrimmedString, cn, formatHttpApiDetail } from "@/lib/utils";

import { DEFAULT_LEAD_OWNER_USERID } from "./lead-drawer-panel";

export type CreateLeadPrefill = {
  phone?: string;
  external_userid?: string;
  customer_name?: string;
  /** 拉取客户下拉的跟进成员 */
  follow_userid?: string;
};

type CreateLeadSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: CreateLeadPrefill;
  onSuccess?: () => void;
  formId?: string;
  /** 客户列表对应的跟进成员（与线索/任务中心筛选一致） */
  customerFollowUserid?: string;
};

function hasPhoneOrExternal(phone: string, externalUserid: string): boolean {
  return Boolean(phone.trim() || externalUserid.trim());
}

export function CreateLeadSheet({
  open,
  onOpenChange,
  prefill = {},
  onSuccess,
  formId = "create-lead",
  customerFollowUserid = "ShiFengwei",
}: CreateLeadSheetProps) {
  const [phone, setPhone] = React.useState("");
  const [selectedExternalId, setSelectedExternalId] = React.useState("");
  const [customerName, setCustomerName] = React.useState("");
  const [intentModel, setIntentModel] = React.useState("");
  const [level, setLevel] = React.useState<
    "H级" | "A级" | "B级" | "C级" | "N级"
  >("B级");
  const [submitting, setSubmitting] = React.useState(false);

  const [options, setOptions] = React.useState<CustomerOption[]>([]);
  const [loadingOptions, setLoadingOptions] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const fu =
      asTrimmedString(prefill.follow_userid) ||
      asTrimmedString(customerFollowUserid) ||
      "ShiFengwei";

    /* eslint-disable react-hooks/set-state-in-effect -- 打开 sheet 时拉取客户选项 */
    setLoadingOptions(true);
    fetchCustomerOptions(fu)
      .then((opts) => {
        if (cancelled) return;
        setOptions(opts);
        const ext = asTrimmedString(prefill.external_userid);
        if (ext && opts.some((o) => o.external_userid === ext)) {
          setSelectedExternalId(ext);
          const row = opts.find((o) => o.external_userid === ext);
          if (row) {
            setPhone(asTrimmedString(row.phone));
            setCustomerName(row.label);
          }
        } else {
          setSelectedExternalId("");
          setPhone(asTrimmedString(prefill.phone));
          setCustomerName(asTrimmedString(prefill.customer_name));
        }
        setIntentModel("");
        setLevel("B级");
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : String(e));
          setOptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingOptions(false);
      });
    /* eslint-enable react-hooks/set-state-in-effect */

    return () => {
      cancelled = true;
    };
  }, [
    open,
    prefill.phone,
    prefill.external_userid,
    prefill.customer_name,
    prefill.follow_userid,
    customerFollowUserid,
  ]);

  function onCustomerChange(value: string) {
    setSelectedExternalId(value);
    if (!value) return;
    const row = options.find((o) => o.external_userid === value);
    if (row) {
      setPhone(asTrimmedString(row.phone));
      setCustomerName(row.label);
    }
  }

  const id = (n: string) => `${formId}-${n}`;

  async function submit() {
    if (!hasPhoneOrExternal(phone, selectedExternalId)) return;
    setSubmitting(true);
    try {
      const r = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          external_userid: selectedExternalId.trim() || null,
          customer_name: customerName.trim(),
          intent_model: intentModel.trim() || null,
          customer_level: level,
          owner_userid: DEFAULT_LEAD_OWNER_USERID,
        }),
      });
      const text = await r.text();
      let detail = text;
      try {
        if (text) detail = formatHttpApiDetail(JSON.parse(text) as unknown);
      } catch {
        /* keep text */
      }
      if (!r.ok) throw new Error(detail || r.statusText);
      toast.success("线索已创建");
      onOpenChange(false);
      onSuccess?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>新建线索</SheetTitle>
          <SheetDescription>
            选择企微客户后将带出手机号与称呼；也可不选客户、仅填手机号。每个企微外部联系人仅允许一条线索。默认归属人：
            {DEFAULT_LEAD_OWNER_USERID}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1">
          <div className="space-y-2">
            <Label htmlFor={id("customer")}>客户</Label>
            <select
              id={id("customer")}
              value={selectedExternalId}
              disabled={loadingOptions}
              onChange={(e) => onCustomerChange(e.target.value)}
              className={cn(
                "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs",
                "focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none",
                loadingOptions && "opacity-60"
              )}
            >
              <option value="">
                {loadingOptions ? "加载客户列表…" : "不选客户（仅填下方手机号）"}
              </option>
              {options.map((o) => (
                <option key={o.external_userid} value={o.external_userid}>
                  {o.label}
                  {o.phone ? ` · ${o.phone}` : ""}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              列表来自当前跟进成员下的企微客户（{asTrimmedString(prefill.follow_userid) || asTrimmedString(customerFollowUserid) || "ShiFengwei"}）。
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={id("phone")}>手机号</Label>
            <Input
              id={id("phone")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="可与「客户」配合或单独填写"
              autoComplete="tel"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={id("name")}>客户姓名</Label>
            <Input
              id={id("name")}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={id("intent")}>意向车型</Label>
            <Input
              id={id("intent")}
              value={intentModel}
              onChange={(e) => setIntentModel(e.target.value)}
              placeholder="可填写如 XC60"
            />
          </div>
          <div className="space-y-2">
            <Label>客户等级</Label>
            <select
              value={level}
              onChange={(e) =>
                setLevel(e.target.value as "H级" | "A级" | "B级" | "C级" | "N级")
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
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={
                !hasPhoneOrExternal(phone, selectedExternalId) || submitting || loadingOptions
              }
              onClick={() => void submit()}
            >
              {submitting ? "提交中…" : "创建"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
