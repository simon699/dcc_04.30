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
import { FollowingLeadsPanel } from "@/components/panel/following-leads-panel";
import { TodayWecomTasks } from "@/components/panel/today-wecom-tasks";
import { TodayOverview } from "@/components/panel/today-overview";

export const dynamic = "force-dynamic";

export default function PanelPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">工作面板</h1>
      </div>

      <TodayOverview />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle>今日待跟进线索</CardTitle>
            </div>
            <Link
              href="/leads"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1")}
            >
              线索列表
              <ArrowRight className="size-4" />
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            <FollowingLeadsPanel />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>今日待完成企微任务</CardTitle>
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
            <TodayWecomTasks />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
