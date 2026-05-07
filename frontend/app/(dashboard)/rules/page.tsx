 "use client";

import * as React from "react";
import { Check, Phone, Settings2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const LEAD_PRIORITY_KEY = "dcc.settings.lead-priority-contact";
type LeadPriority = "phone" | "wecom";

export default function RulesPage() {
  const [leadPriority, setLeadPriority] = React.useState<LeadPriority>("phone");

  React.useEffect(() => {
    const cached = window.localStorage.getItem(LEAD_PRIORITY_KEY);
    if (cached === "phone" || cached === "wecom") {
      setLeadPriority(cached);
    }
  }, []);

  function handleSelect(next: LeadPriority) {
    setLeadPriority(next);
    window.localStorage.setItem(LEAD_PRIORITY_KEY, next);
    toast.success(`已自动保存：线索优先${next === "phone" ? "电话" : "企微"}跟进`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">设置</h1>
        <p className="mt-1 text-muted-foreground">
          配置个人跟进偏好；修改后自动保存。
        </p>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings2 className="size-5 text-muted-foreground" />
            <CardTitle>线索跟进偏好</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            线索优先（电话 / 企微）进行跟进
          </p>
          <div className="grid gap-2 sm:max-w-md sm:grid-cols-2">
            <button
              type="button"
              onClick={() => handleSelect("phone")}
              className={cn(
                "flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                leadPriority === "phone"
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-muted/40"
              )}
              aria-pressed={leadPriority === "phone"}
            >
              <span className="inline-flex items-center gap-2 text-sm font-medium">
                <Phone className="size-4 text-emerald-600" aria-hidden />
                电话优先
              </span>
              {leadPriority === "phone" ? (
                <Check className="size-4 text-primary" aria-hidden />
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => handleSelect("wecom")}
              className={cn(
                "flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                leadPriority === "wecom"
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-muted/40"
              )}
              aria-pressed={leadPriority === "wecom"}
            >
              <span className="inline-flex items-center gap-2 text-sm font-medium">
                <MessageCircle className="size-4 text-[#07C160]" aria-hidden />
                企微优先
              </span>
              {leadPriority === "wecom" ? (
                <Check className="size-4 text-primary" aria-hidden />
              ) : null}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            已保存到本机浏览器；刷新页面后仍会保留当前选择。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
