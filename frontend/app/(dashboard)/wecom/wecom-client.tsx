"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, MessageCircle } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getLeadName, getTask } from "@/lib/mock-data";

export function WecomWorkbenchClient() {
  const searchParams = useSearchParams();
  const taskId = searchParams.get("taskId");
  const task = taskId ? getTask(taskId) : undefined;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/tasks"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "gap-1 pl-0"
        )}
      >
        <ArrowLeft className="size-4" />
        返回任务中心
      </Link>

      <div>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-900 dark:text-amber-100">
          演示环境 · 非真实企微客户端
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          企微工作台跟进
        </h1>
        <p className="mt-1 text-muted-foreground">
          模拟从任务跳转后的会话与跟进上下文。
        </p>
      </div>

      <Card className="overflow-hidden border-green-600/20 bg-gradient-to-br from-green-50/80 to-background dark:from-green-950/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-10 items-center justify-center rounded-lg bg-green-600 text-white">
              <MessageCircle className="size-5" />
            </div>
            <div>
              <CardTitle className="text-lg">
                {task ? task.title : "未指定任务"}
              </CardTitle>
              <CardDescription>
                {task
                  ? `关联线索：${getLeadName(task.leadId)}`
                  : "通过任务列表进入可带上 taskId"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-border/60 bg-background/70 p-3">
            <p className="text-xs text-muted-foreground">企微侧边栏预留入口</p>
            <Link
              href={`/wecom/customer-profile${task?.leadId ? `?leadId=${task.leadId}` : ""}`}
              className={cn(buttonVariants({ size: "sm", variant: "outline" }), "mt-2 w-full")}
            >
              打开客户画像 H5 页面
            </Link>
          </div>
          <div className="rounded-lg border bg-card p-4 font-mono text-sm leading-relaxed text-muted-foreground">
            [会话列表]
            <br />
            ▸ 客户咨询报价 → 待回复
            <br />
            ▸ 上周会议纪要 PDF 已发送
            <br />
            <span className="text-foreground">
              ▸ 此处可嵌入企业微信 Web / 自建工作台 iframe（Demo 省略）
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            真实环境需企业微信 JS-SDK、OAuth 与可信域名配置。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
