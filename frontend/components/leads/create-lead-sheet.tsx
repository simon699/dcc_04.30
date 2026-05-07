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
import { cn } from "@/lib/utils";

import { DEFAULT_LEAD_OWNER_USERID } from "./lead-drawer-panel";

export type CreateLeadPrefill = {
  phone?: string;
  external_userid?: string;
  customer_name?: string;
};

type CreateLeadSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 打开时用于预填（如客户中心行内创建） */
  prefill?: CreateLeadPrefill;
  onSuccess?: () => void;
  /** 若提供，用于区分页内多实例的表单 id，避免 label 重复 */
  formId?: string;
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
}: CreateLeadSheetProps) {
  const [phone, setPhone] = React.useState("");
  const [externalUserid, setExternalUserid] = React.useState("");
  const [customerName, setCustomerName] = React.useState("");
  const [intentModel, setIntentModel] = React.useState("");
  const [level, setLevel] = React.useState<
    "H级" | "A级" | "B级" | "C级" | "N级"
  >("B级");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setPhone((prefill.phone ?? "").trim());
    setExternalUserid((prefill.external_userid ?? "").trim());
    setCustomerName((prefill.customer_name ?? "").trim());
    setIntentModel("");
    setLevel("B级");
  }, [open, prefill.phone, prefill.external_userid, prefill.customer_name]);

  const id = (n: string) => `${formId}-${n}`;

  function submit() {
    if (!hasPhoneOrExternal(phone, externalUserid)) return;
    setSubmitting(true);
    fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: phone.trim(),
        external_userid: externalUserid.trim() || null,
        customer_name: customerName.trim(),
        intent_model: intentModel.trim() || null,
        customer_level: level,
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
        toast.success("线索已创建");
        onOpenChange(false);
        onSuccess?.();
      })
      .catch((e: Error) => {
        toast.error(e.message || "创建失败");
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>新建线索</SheetTitle>
          <SheetDescription>
            手机号与「客户 ID（external_userid）」至少填一项。默认归属人：
            {DEFAULT_LEAD_OWNER_USERID}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1">
          <div className="space-y-2">
            <Label htmlFor={id("phone")}>手机号</Label>
            <Input
              id={id("phone")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="与 external_userid 二选一或都填"
              autoComplete="tel"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={id("ext")}>客户 ID（external_userid）</Label>
            <Input
              id={id("ext")}
              value={externalUserid}
              onChange={(e) => setExternalUserid(e.target.value)}
              placeholder="企微外部联系人 ID"
              className="font-mono text-sm"
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
              disabled={!hasPhoneOrExternal(phone, externalUserid) || submitting}
              onClick={submit}
            >
              {submitting ? "提交中…" : "创建"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
