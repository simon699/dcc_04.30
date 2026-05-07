"use client";

import * as React from "react";

import { CreateWecomTaskSheet } from "@/components/tasks/create-wecom-task-sheet";
import { TaskTable, type ChannelTab } from "@/components/tasks/task-table";
import { Button } from "@/components/ui/button";

export default function TasksPage() {
  const [channelTab, setChannelTab] = React.useState<ChannelTab>("all");
  const [taskSheetOpen, setTaskSheetOpen] = React.useState(false);
  const [refreshNonce, setRefreshNonce] = React.useState(0);

  const defaultChannel: "phone" | "wecom" =
    channelTab === "phone" ? "phone" : "wecom";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">任务中心</h1>
          <p className="mt-1 text-muted-foreground">
            数据来自后台任务表；按任务对象（客户）展开展示，点击任务名称查看详情。
          </p>
        </div>
        <Button type="button" onClick={() => setTaskSheetOpen(true)}>
          创建任务
        </Button>
      </div>

      <TaskTable
        channelTab={channelTab}
        onChannelTabChange={setChannelTab}
        refreshNonce={refreshNonce}
      />

      <CreateWecomTaskSheet
        open={taskSheetOpen}
        onOpenChange={setTaskSheetOpen}
        defaultChannel={defaultChannel}
        onSuccess={() => setRefreshNonce((n) => n + 1)}
        formId="tasks-center"
      />
    </div>
  );
}
