import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TodayPendingPanel } from "@/components/panel/today-pending-panel";
import { TodayOverview } from "@/components/panel/today-overview";

export const dynamic = "force-dynamic";

export default function PanelPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">工作面板</h1>
      </div>

      <TodayOverview />

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle>今日待完成</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              截止日期为今日且尚未完成的任务对象；可按电话 / 企微切换
            </p>
          </div>
          <Link
            href="/tasks"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1")}
          >
            任务中心
            <ArrowRight className="size-4" />
          </Link>
        </CardHeader>
        <CardContent className="pt-0">
          <TodayPendingPanel />
        </CardContent>
      </Card>
    </div>
  );
}
