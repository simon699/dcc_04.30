"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { fetchCustomerOptions, type CustomerOption } from "@/lib/customer-options";
import { asTrimmedString, cn, formatHttpApiDetail } from "@/lib/utils";

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
  /** 任务对象客户列表的跟进成员 */
  customerFollowUserid?: string;
  /** 打开表单时的默认触达方式（任务中心 Tab：电话→phone，全部/企微→wecom） */
  defaultChannel?: "phone" | "wecom";
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
  const [taskType, setTaskType] = React.useState<"mass_send" | "follow_up">(
    "follow_up"
  );
  const [channel, setChannel] = React.useState<"phone" | "wecom">("wecom");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [massContent, setMassContent] = React.useState("");
  const [startAt, setStartAt] = React.useState("");
  const [deadline, setDeadline] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const [options, setOptions] = React.useState<CustomerOption[]>([]);
  const [loadingOptions, setLoadingOptions] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [filterQuery, setFilterQuery] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const fu = asTrimmedString(customerFollowUserid) || "ShiFengwei";
    /* eslint-disable react-hooks/set-state-in-effect -- 打开 sheet 时拉取客户列表 */
    setLoadingOptions(true);
    setFilterQuery("");
    fetchCustomerOptions(fu)
      .then((opts) => {
        if (cancelled) return;
        setOptions(opts);
        const want =
          prefill?.targets
            ?.map((t) => asTrimmedString(t.target_external_userid))
            .filter(Boolean) ?? [];
        const ok = want.filter((id) => opts.some((o) => o.external_userid === id));
        setSelectedIds(ok);
        setName("");
        setDescription("");
        setMassContent("");
        setTaskType("follow_up");
        setChannel(defaultChannel ?? "wecom");
        setStartAt("");
        setDeadline("");
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : String(e));
          setOptions([]);
          setSelectedIds([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingOptions(false);
      });
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => {
      cancelled = true;
    };
  }, [open, prefill, customerFollowUserid, defaultChannel]);

  function toggleId(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const filteredOptions = React.useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const blob = `${o.label} ${o.external_userid} ${o.phone ?? ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [options, filterQuery]);

  const id = (s: string) => `${formId}-${s}`;

  async function submit() {
    if (!name.trim()) {
      toast.error("请填写任务名称");
      return;
    }
    if (selectedIds.length === 0) {
      toast.error("请至少选择一个客户作为任务对象");
      return;
    }

    const targets = selectedIds.map((ext) => {
      const o = options.find((x) => x.external_userid === ext);
      const ph = o?.phone ? asTrimmedString(o.phone).replace(/\s/g, "") : "";
      return {
        target_external_userid: ext,
        target_phone: ph || null,
      };
    });

    const body: Record<string, unknown> = {
      task_type: taskType,
      channel,
      name: name.trim(),
      description: description.trim() || null,
      mass_content: taskType === "mass_send" ? massContent.trim() || null : null,
      creator_userid: DEFAULT_CREATOR,
      targets,
    };
    if (startAt.trim()) body.start_at = new Date(startAt).toISOString();
    if (deadline.trim()) body.deadline = new Date(deadline).toISOString();

    setSubmitting(true);
    try {
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={id("type")}>任务类型</Label>
              <select
                id={id("type")}
                value={taskType}
                onChange={(e) =>
                  setTaskType(e.target.value as "mass_send" | "follow_up")
                }
                className={cn(
                  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs",
                  "focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                )}
              >
                <option value="follow_up">跟进任务</option>
                <option value="mass_send">群发任务</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={id("ch")}>触达方式</Label>
              <select
                id={id("ch")}
                value={channel}
                onChange={(e) =>
                  setChannel(e.target.value as "phone" | "wecom")
                }
                className={cn(
                  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs",
                  "focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                )}
              >
                <option value="wecom">企微</option>
                <option value="phone">电话</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={id("name")}>任务名称 *</Label>
            <Input
              id={id("name")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="简短名称"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={id("desc")}>任务描述</Label>
            <Textarea
              id={id("desc")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {taskType === "mass_send" ? (
            <div className="space-y-2">
              <Label htmlFor={id("mass")}>群发内容</Label>
              <Textarea
                id={id("mass")}
                value={massContent}
                onChange={(e) => setMassContent(e.target.value)}
                rows={4}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>任务对象 *（多选客户）</Label>
            <Input
              id={id("filter")}
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="搜索昵称、手机号或 external_userid"
              disabled={loadingOptions}
              className="text-sm"
            />
            <div
              className={cn(
                "max-h-52 overflow-y-auto rounded-md border border-input bg-background px-2 py-2",
                loadingOptions && "opacity-60"
              )}
            >
              {loadingOptions ? (
                <p className="px-1 py-3 text-sm text-muted-foreground">加载客户列表…</p>
              ) : filteredOptions.length === 0 ? (
                <p className="px-1 py-3 text-sm text-muted-foreground">
                  {options.length === 0 ? "暂无客户，请先同步企微客户。" : "无匹配客户"}
                </p>
              ) : (
                <ul className="space-y-1">
                  {filteredOptions.map((o) => {
                    const checked = selectedIds.includes(o.external_userid);
                    return (
                      <li key={o.external_userid}>
                        <label className="flex cursor-pointer items-start gap-2 rounded px-1 py-1.5 text-sm hover:bg-muted/60">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={checked}
                            onChange={() => toggleId(o.external_userid)}
                          />
                          <span className="min-w-0 flex-1 leading-snug">
                            <span className="font-medium">{o.label}</span>
                            <span className="mt-0.5 block font-mono text-xs text-muted-foreground break-all">
                              {o.external_userid}
                            </span>
                            {o.phone ? (
                              <span className="text-xs text-muted-foreground">{o.phone}</span>
                            ) : null}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              已选 {selectedIds.length} 人
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={id("start")}>开始执行时间</Label>
              <Input
                id={id("start")}
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={id("due")}>截止时间</Label>
              <Input
                id={id("due")}
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>创建人</Label>
            <Input readOnly value={DEFAULT_CREATOR} className="bg-muted/50" />
          </div>

          <div className="flex gap-2 pt-2">
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
              disabled={submitting || loadingOptions}
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
