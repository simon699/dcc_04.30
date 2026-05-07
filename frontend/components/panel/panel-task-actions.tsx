"use client";

import { useRouter } from "next/navigation";
import { MessageCircle, PanelRight, Phone } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { getLead, getTask } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/lib/store/ui-store";

export function PanelTaskActions({ taskId }: { taskId: string }) {
  const router = useRouter();
  const openDrawer = useUiStore((s) => s.openDrawer);
  const task = getTask(taskId);

  if (!task) return null;

  return (
    <div className="flex shrink-0 flex-wrap gap-2">
      <Button
        size="sm"
        variant="outline"
        className="gap-1"
        onClick={(e) => {
          e.stopPropagation();
          openDrawer({ type: "task", id: taskId });
        }}
      >
        <PanelRight className="size-3.5" />
        抽屉
      </Button>
      {task.channel === "wecom" ? (
        <Button
          size="sm"
          className="gap-1"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/wecom?taskId=${task.id}`);
          }}
        >
          <MessageCircle className="size-3.5" />
          企微
        </Button>
      ) : null}
      {task.channel === "phone" ? (
        <a
          href={`tel:${(getLead(task.leadId)?.phone ?? "").replace(/\s/g, "")}`}
          className={cn(buttonVariants({ size: "sm" }), "gap-1")}
          onClick={(e) => e.stopPropagation()}
        >
          <Phone className="size-3.5" />
          电话
        </a>
      ) : null}
    </div>
  );
}
