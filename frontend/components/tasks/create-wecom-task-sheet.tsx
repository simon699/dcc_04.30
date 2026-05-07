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
import { cn } from "@/lib/utils";

const DEFAULT_CREATOR = "ShiFengwei";

export type TaskTargetPrefill = {
  target_external_userid?: string;
  target_phone?: string;
};

export type CreateWecomTaskPrefill = {
  targets?: TaskTargetPrefill[];
};

function formatIsoLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 每行一个：external_userid 或手机号 */
function parseTargetsBlock(text: string): TaskTargetPrefill[] {
  const lines = text
    .split(/[\n,，;；]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: TaskTargetPrefill[] = [];
  for (const line of lines) {
    const phoneLike = /^\+?\d{5,20}$/.test(line.replace(/\s/g, ""));
    if (phoneLike && line.replace(/\D/g, "").length >= 5) {
      out.push({ target_phone: line.replace(/\s/g, "") });
    } else {
      out.push({ target_external_userid: line });
    }
  }
  return out;
}

function targetsToBlock(targets: TaskTargetPrefill[]): string {
  return targets
    .map((t) => t.target_external_userid?.trim() || t.target_phone?.trim() || "")
    .filter(Boolean)
    .join("\n");
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: CreateWecomTaskPrefill;
  onSuccess?: () => void;
  formId?: string;
};

export function CreateWecomTaskSheet({
  open,
  onOpenChange,
  prefill,
  onSuccess,
  formId = "create-wecom-task",
}: Props) {
  const [taskType, setTaskType] = React.useState<"mass_send" | "follow_up">(
    "follow_up"
  );
  const [channel, setChannel] = React.useState<"phone" | "wecom">("wecom");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [massContent, setMassContent] = React.useState("");
  const [targetsBlock, setTargetsBlock] = React.useState("");
  const [startAt, setStartAt] = React.useState("");
  const [deadline, setDeadline] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const pf = prefill?.targets?.length
      ? targetsToBlock(prefill.targets)
      : "";
    setTargetsBlock(pf);
    setName("");
    setDescription("");
    setMassContent("");
    setTaskType("follow_up");
    setChannel("wecom");
    setStartAt("");
    setDeadline("");
  }, [open, prefill]);

  const id = (s: string) => `${formId}-${s}`;

  function submit() {
    const parsed = parseTargetsBlock(targetsBlock);
    if (!name.trim()) {
      toast.error("请填写任务名称");
      return;
    }
    if (parsed.length === 0) {
      toast.error("请填写至少一个任务对象（external_userid 或手机号）");
      return;
    }

    const body: Record<string, unknown> = {
      task_type: taskType,
      channel,
      name: name.trim(),
      description: description.trim() || null,
      mass_content: taskType === "mass_send" ? massContent.trim() || null : null,
      creator_userid: DEFAULT_CREATOR,
      targets: parsed.map((t) => ({
        target_external_userid: t.target_external_userid ?? null,
        target_phone: t.target_phone ?? null,
      })),
    };
    if (startAt.trim()) body.start_at = new Date(startAt).toISOString();
    if (deadline.trim()) body.deadline = new Date(deadline).toISOString();

    setSubmitting(true);
    fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then(() => {
        toast.success("任务已创建");
        onOpenChange(false);
        onSuccess?.();
      })
      .catch((e: Error) => toast.error(e.message || "创建失败"))
      .finally(() => setSubmitting(false));
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>新建任务</SheetTitle>
          <SheetDescription>
            创建人默认：{DEFAULT_CREATOR}；任务对象支持多个 external_userid 或手机号（每行一条）。
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
            <Label htmlFor={id("targets")}>任务对象 *</Label>
            <Textarea
              id={id("targets")}
              value={targetsBlock}
              onChange={(e) => setTargetsBlock(e.target.value)}
              rows={5}
              placeholder={"每行一个 external_userid 或手机号\n可从线索/客户页带入"}
              className="font-mono text-xs"
            />
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
              disabled={submitting}
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
