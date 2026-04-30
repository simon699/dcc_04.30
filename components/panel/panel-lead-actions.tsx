"use client";

import { buttonVariants } from "@/components/ui/button";
import { getLead } from "@/lib/mock-data";
import { useUiStore } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";

export function PanelLeadActions({ leadId }: { leadId: string }) {
  const openDrawer = useUiStore((s) => s.openDrawer);
  const lead = getLead(leadId);
  if (!lead) return null;

  return (
    <button
      type="button"
      className="flex w-full items-start justify-between gap-3 rounded-md text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => openDrawer({ type: "lead", id: leadId })}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium">{lead.name}</p>
        <p className="truncate text-sm text-muted-foreground">{lead.company}</p>
      </div>
      <span
        className={cn(
          buttonVariants({ size: "sm", variant: "outline" }),
          "pointer-events-none shrink-0"
        )}
      >
        详情
      </span>
    </button>
  );
}
