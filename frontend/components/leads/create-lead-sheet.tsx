"use client";

import * as React from "react";
import { Button, Form, Input, Select, Space } from "antd";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  fetchCustomerOptions,
  type CustomerOption,
} from "@/lib/customer-options";
import { asTrimmedString, cn, formatHttpApiDetail } from "@/lib/utils";

import { DEFAULT_LEAD_OWNER_USERID } from "./lead-drawer-panel";

const LEVEL_OPTIONS = [
  { value: "H级", label: "H级" },
  { value: "A级", label: "A级" },
  { value: "B级", label: "B级" },
  { value: "C级", label: "C级" },
  { value: "N级", label: "N级" },
];

export type CreateLeadPrefill = {
  phone?: string;
  external_userid?: string;
  customer_name?: string;
  follow_userid?: string;
};

type CreateLeadSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: CreateLeadPrefill;
  onSuccess?: () => void;
  formId?: string;
  customerFollowUserid?: string;
  /** 从客户中心等入口打开时锁定当前客户，不可改选 */
  lockCustomer?: boolean;
  /** H5 等场景从底部弹出 */
  sheetSide?: "right" | "bottom";
};

type FormValues = {
  external_userid?: string | null;
  phone: string;
  customer_name: string;
  intent_model?: string;
  customer_level: string;
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
  lockCustomer = false,
  sheetSide = "right",
}: CreateLeadSheetProps) {
  const [form] = Form.useForm<FormValues>();
  const [options, setOptions] = React.useState<CustomerOption[]>([]);
  const [loadingOptions, setLoadingOptions] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

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
        const ext = asTrimmedString(prefill.external_userid);
        let merged: CustomerOption[] = opts;
        if (lockCustomer && ext && !opts.some((o) => o.external_userid === ext)) {
          merged = [
            {
              external_userid: ext,
              label:
                asTrimmedString(prefill.customer_name) ||
                asTrimmedString(prefill.phone) ||
                ext,
              phone: asTrimmedString(prefill.phone) || null,
            },
            ...opts,
          ];
        }
        setOptions(merged);

        if (lockCustomer && ext) {
          const row = merged.find((o) => o.external_userid === ext);
          form.setFieldsValue({
            external_userid: ext,
            phone: asTrimmedString(
              row?.phone ?? prefill.phone ?? ""
            ),
            customer_name:
              row?.label ?? asTrimmedString(prefill.customer_name),
            intent_model: "",
            customer_level: "N级",
          });
        } else if (ext && merged.some((o) => o.external_userid === ext)) {
          const row = merged.find((o) => o.external_userid === ext);
          form.setFieldsValue({
            external_userid: ext,
            phone: row ? asTrimmedString(row.phone) : "",
            customer_name: row?.label ?? "",
            intent_model: "",
            customer_level: "N级",
          });
        } else {
          form.setFieldsValue({
            external_userid: null,
            phone: asTrimmedString(prefill.phone),
            customer_name: asTrimmedString(prefill.customer_name),
            intent_model: "",
            customer_level: "N级",
          });
        }
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
    lockCustomer,
    form,
  ]);

  function onCustomerChange(ext: string) {
    if (!ext) return;
    const row = options.find((o) => o.external_userid === ext);
    if (row) {
      form.setFieldsValue({
        phone: asTrimmedString(row.phone),
        customer_name: row.label,
      });
    }
  }

  async function submit() {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const ext = String(values.external_userid ?? "").trim();
    const phone = (values.phone ?? "").trim();
    if (!hasPhoneOrExternal(phone, ext)) return;

    setSubmitting(true);
    try {
      const r = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          external_userid: ext || null,
          customer_name: values.customer_name.trim(),
          intent_model: values.intent_model?.trim() || null,
          customer_level: values.customer_level,
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
      <SheetContent
        side={sheetSide}
        className={cn(
          "flex w-full flex-col overflow-y-auto",
          sheetSide === "bottom"
            ? "max-h-[88vh] rounded-t-2xl border-x-0 p-0 pt-2"
            : "sm:max-w-md"
        )}
      >
        <SheetHeader
          className={cn(sheetSide === "bottom" && "px-4 pb-2 pt-1")}
        >
          <SheetTitle>新建线索</SheetTitle>
          <SheetDescription>
            {lockCustomer ? (
              <>
                当前客户已固定，将为此客户创建线索。每个企微外部联系人仅允许一条线索。默认归属人：
                {DEFAULT_LEAD_OWNER_USERID}
              </>
            ) : (
              <>
                选择企微客户后将带出手机号与称呼；也可不选客户、仅填手机号。每个企微外部联系人仅允许一条线索。默认归属人：
                {DEFAULT_LEAD_OWNER_USERID}
              </>
            )}
          </SheetDescription>
        </SheetHeader>
        <div
          className={cn(
            "mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1",
            sheetSide === "bottom" && "mt-2 px-4 pb-6"
          )}
        >
          <Form<FormValues>
            id={formId}
            form={form}
            layout="vertical"
            initialValues={{
              phone: "",
              customer_name: "",
              intent_model: "",
              customer_level: "N级",
            }}
          >
            <Form.Item name="external_userid" label="客户">
              <Select
                allowClear={!lockCustomer}
                showSearch
                optionFilterProp="label"
                loading={loadingOptions}
                disabled={loadingOptions || lockCustomer}
                placeholder={
                  loadingOptions ? "加载客户列表…" : "不选则仅填下方手机号"
                }
                options={options.map((o) => ({
                  value: o.external_userid,
                  label: `${o.label}${o.phone ? ` · ${o.phone}` : ""}`,
                }))}
                onChange={(v) => {
                  if (v) onCustomerChange(v);
                }}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {lockCustomer
                  ? "客户已与当前档案绑定，不可更改。"
                  : `列表来自当前跟进成员下的企微客户（${
                      asTrimmedString(prefill.follow_userid) ||
                      asTrimmedString(customerFollowUserid) ||
                      "ShiFengwei"
                    }）。`}
              </p>
            </Form.Item>

            <Form.Item name="phone" label="手机号">
              <Input placeholder="可与「客户」配合或单独填写" autoComplete="tel" />
            </Form.Item>

            <Form.Item name="customer_name" label="客户姓名">
              <Input />
            </Form.Item>

            <Form.Item name="intent_model" label="意向车型">
              <Input placeholder="可填写如 XC60" />
            </Form.Item>

            <Form.Item
              name="customer_level"
              label="客户等级"
              rules={[{ required: true, message: "请选择客户等级" }]}
            >
              <Select options={LEVEL_OPTIONS} />
            </Form.Item>

            <Form.Item label="默认归属人">
              <Input readOnly value={DEFAULT_LEAD_OWNER_USERID} />
            </Form.Item>
          </Form>

          <Space className="mt-auto w-full pt-4">
            <Button className="flex-1" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button
              type="primary"
              className="flex-1"
              loading={submitting || loadingOptions}
              onClick={() => void submit()}
            >
              创建
            </Button>
          </Space>
        </div>
      </SheetContent>
    </Sheet>
  );
}
