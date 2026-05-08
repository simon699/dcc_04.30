"use client";

import * as React from "react";
import {
  Button,
  DatePicker,
  Form,
  Input,
  Select,
  Space,
} from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { fetchCustomerOptions, type CustomerOption } from "@/lib/customer-options";
import { formatCnWallClockApi } from "@/lib/datetime-cn";
import { asTrimmedString, formatHttpApiDetail } from "@/lib/utils";

dayjs.locale("zh-cn");

const DEFAULT_CREATOR = "ShiFengwei";

export type TaskTargetPrefill = {
  target_external_userid?: string;
  target_phone?: string;
};

export type CreateWecomTaskPrefill = {
  targets?: TaskTargetPrefill[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: CreateWecomTaskPrefill;
  onSuccess?: () => void;
  formId?: string;
  customerFollowUserid?: string;
  defaultChannel?: "phone" | "wecom";
};

type FormValues = {
  task_type: "mass_send" | "follow_up";
  channel: "phone" | "wecom";
  name: string;
  description?: string;
  mass_content?: string;
  targets: string[];
  start_at?: Dayjs | null;
  deadline?: Dayjs | null;
};

export function CreateWecomTaskSheet({
  open,
  onOpenChange,
  prefill,
  onSuccess,
  formId = "create-wecom-task",
  customerFollowUserid = "ShiFengwei",
  defaultChannel,
}: Props) {
  const [form] = Form.useForm<FormValues>();
  const taskType = Form.useWatch("task_type", form);

  const [options, setOptions] = React.useState<CustomerOption[]>([]);
  const [loadingOptions, setLoadingOptions] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const fu = asTrimmedString(customerFollowUserid) || "ShiFengwei";
    /* eslint-disable react-hooks/set-state-in-effect -- 打开 sheet 时拉取客户列表 */
    setLoadingOptions(true);
    fetchCustomerOptions(fu)
      .then((opts) => {
        if (cancelled) return;
        setOptions(opts);
        const want =
          prefill?.targets
            ?.map((t) => asTrimmedString(t.target_external_userid))
            .filter(Boolean) ?? [];
        const ok = want.filter((id) => opts.some((o) => o.external_userid === id));
        form.resetFields();
        form.setFieldsValue({
          task_type: "follow_up",
          channel: defaultChannel ?? "wecom",
          name: "",
          description: "",
          mass_content: "",
          targets: ok,
          start_at: undefined,
          deadline: undefined,
        });
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
  }, [open, prefill, customerFollowUserid, defaultChannel, form]);

  const customerSelectOptions = React.useMemo(
    () =>
      options.map((o) => ({
        value: o.external_userid,
        label: `${o.label}${o.phone ? ` · ${o.phone}` : ""}`,
      })),
    [options]
  );

  async function submit() {
    try {
      const values = await form.validateFields();
      if (!values.name?.trim()) {
        toast.error("请填写任务名称");
        return;
      }
      const sel = values.targets ?? [];
      if (!Array.isArray(sel) || sel.length === 0) {
        toast.error("请至少选择一个客户作为任务对象");
        return;
      }

      const targets = sel.map((ext) => {
        const o = options.find((x) => x.external_userid === ext);
        const ph = o?.phone ? asTrimmedString(o.phone).replace(/\s/g, "") : "";
        return {
          target_external_userid: ext,
          target_phone: ph || null,
        };
      });

      const body: Record<string, unknown> = {
        task_type: values.task_type,
        channel: values.channel,
        name: values.name.trim(),
        description: values.description?.trim() || null,
        mass_content:
          values.task_type === "mass_send"
            ? values.mass_content?.trim() || null
            : null,
        creator_userid: DEFAULT_CREATOR,
        targets,
      };

      const start = values.start_at;
      const due = values.deadline;
      if (start) {
        const s = dayjs(start);
        if (s.isValid()) body.start_at = formatCnWallClockApi(s);
      }
      if (due) {
        const d = dayjs(due);
        if (d.isValid()) body.deadline = formatCnWallClockApi(d);
      }

      setSubmitting(true);
      const r = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await r.text();
      let detail = text;
      try {
        if (text) detail = formatHttpApiDetail(JSON.parse(text) as unknown);
      } catch {
        /* keep text */
      }
      if (!r.ok) throw new Error(detail || r.statusText);
      toast.success("任务已创建");
      onOpenChange(false);
      onSuccess?.();
    } catch (e: unknown) {
      if (e && typeof e === "object" && "errorFields" in e) return;
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>新建任务</SheetTitle>
          <SheetDescription>
            创建人默认：{DEFAULT_CREATOR}；任务对象从客户列表多选（跟进成员：
            {asTrimmedString(customerFollowUserid) || "ShiFengwei"}）。
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex flex-col gap-4 px-1 pb-6">
          <Form<FormValues>
            id={formId}
            form={form}
            layout="vertical"
            initialValues={{
              task_type: "follow_up",
              channel: defaultChannel ?? "wecom",
              targets: [],
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Form.Item
                name="task_type"
                label="任务类型"
                rules={[{ required: true, message: "请选择任务类型" }]}
              >
                <Select
                  options={[
                    { value: "follow_up", label: "跟进任务" },
                    { value: "mass_send", label: "群发任务" },
                  ]}
                />
              </Form.Item>
              <Form.Item
                name="channel"
                label="触达方式"
                rules={[{ required: true, message: "请选择触达方式" }]}
              >
                <Select
                  options={[
                    { value: "wecom", label: "企微" },
                    { value: "phone", label: "电话" },
                  ]}
                />
              </Form.Item>
            </div>

            <Form.Item
              name="name"
              label="任务名称"
              rules={[{ required: true, message: "请填写任务名称" }]}
            >
              <Input placeholder="简短名称" />
            </Form.Item>

            <Form.Item name="description" label="任务描述">
              <Input.TextArea rows={2} placeholder="可选" />
            </Form.Item>

            {taskType === "mass_send" ? (
              <Form.Item
                name="mass_content"
                label="群发内容"
                rules={[{ required: true, message: "请填写群发内容" }]}
              >
                <Input.TextArea rows={4} placeholder="群发正文" />
              </Form.Item>
            ) : null}

            <Form.Item
              name="targets"
              label="任务对象（多选客户）"
              rules={[
                {
                  required: true,
                  type: "array",
                  min: 1,
                  message: "请至少选择一个客户",
                },
              ]}
            >
              <Select
                mode="multiple"
                allowClear
                showSearch
                optionFilterProp="label"
                loading={loadingOptions}
                placeholder={
                  loadingOptions ? "加载客户列表…" : "搜索并选择客户"
                }
                options={customerSelectOptions}
              />
            </Form.Item>

            <div className="grid gap-4 sm:grid-cols-2">
              <Form.Item name="start_at" label="开始执行时间">
                <DatePicker
                  showTime
                  className="w-full"
                  format="YYYY-MM-DD HH:mm"
                  needConfirm={false}
                />
              </Form.Item>
              <Form.Item name="deadline" label="截止时间">
                <DatePicker
                  showTime
                  className="w-full"
                  format="YYYY-MM-DD HH:mm"
                  needConfirm={false}
                />
              </Form.Item>
            </div>

            <Form.Item label="创建人">
              <Input readOnly value={DEFAULT_CREATOR} />
            </Form.Item>
          </Form>

          <Space className="w-full pt-2">
            <Button
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
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
