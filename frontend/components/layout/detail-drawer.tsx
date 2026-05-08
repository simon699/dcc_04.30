"use client";

import { useRouter } from "next/navigation";
import { ExternalLink, MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  type FollowBucketKey,
  channelLabel,
  getFollowBucketLabel,
  getLead,
  getLeadByName,
  getPhoneGroupTaskDetail,
  getTask,
  getWecomTaskPanelDetail,
  taskStatusLabel,
} from "@/lib/mock-data";
import { LeadDrawerPanel } from "@/components/leads/lead-drawer-panel";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import { useUiStore } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";
import { WecomCustomerProfileClient } from "@/app/(dashboard)/wecom/customer-profile/wecom-customer-profile-client";
import { CustomerCenterDrawerPanel } from "@/components/customers/customer-center-drawer-panel";

export function DetailDrawer() {
  const router = useRouter();
  const drawerOpen = useUiStore((s) => s.drawerOpen);
  const drawerPayload = useUiStore((s) => s.drawerPayload);
  const closeDrawer = useUiStore((s) => s.closeDrawer);
  const openDrawer = useUiStore((s) => s.openDrawer);

  const isApiTask =
    drawerPayload?.type === "task" &&
    Boolean(drawerPayload.id && /^\d+$/.test(drawerPayload.id));

  const task =
    drawerPayload?.type === "task" && !isApiTask ? getTask(drawerPayload.id) : undefined;
  const isWecomProfileDrawer = drawerPayload?.type === "wecom_profile";
  const isWecomImageDrawer = drawerPayload?.type === "wecom_image";
  const isCustomerDrawer = drawerPayload?.type === "customer";
  const drawerWidthClass = isWecomProfileDrawer
    ? "flex h-full w-full max-w-full flex-col gap-0 p-0 sm:!w-[420px] sm:!max-w-[420px]"
    : isWecomImageDrawer
      ? "flex h-full w-full max-w-full flex-col gap-0 p-0 sm:!w-[50vw] sm:!max-w-[50vw]"
      : "flex h-full w-full max-w-full flex-col gap-0 p-0 sm:!w-[50vw] sm:!max-w-[50vw]";
  const phoneGroupKey =
    drawerPayload?.type === "task" && drawerPayload.phoneGroupKey
      ? (drawerPayload.phoneGroupKey as FollowBucketKey)
      : undefined;
  const phoneGroupDetail = phoneGroupKey ? getPhoneGroupTaskDetail(phoneGroupKey) : null;
  const isPhoneGroupTask =
    drawerPayload?.type === "task" && !task && Boolean(phoneGroupKey);

  const leadId =
    drawerPayload?.type === "lead"
      ? drawerPayload.id
      : drawerPayload?.type === "task"
        ? drawerPayload.currentLeadId ?? task?.leadId
        : drawerPayload?.type === "wecom_profile"
          ? drawerPayload.leadId
          : drawerPayload?.type === "wecom_image"
            ? drawerPayload.leadId
        : undefined;

  const displayLead = leadId ? getLead(leadId) : undefined;

  const title =
    drawerPayload?.type === "lead"
      ? "线索详情"
      : drawerPayload?.type === "customer"
        ? "客户详情"
      : isApiTask
        ? "任务详情"
      : drawerPayload?.type === "wecom_profile"
        ? "客户画像"
      : drawerPayload?.type === "wecom_image"
        ? "企微工作台"
      : isPhoneGroupTask
        ? getFollowBucketLabel(phoneGroupKey as FollowBucketKey)
        : task?.title ?? "任务";
  const wecomDetail = task?.channel === "wecom" ? getWecomTaskPanelDetail(task) : null;
  const currentCustomerName =
    drawerPayload?.type === "task" ? drawerPayload.currentCustomerName : undefined;
  const currentCustomerStatus =
    drawerPayload?.type === "task" ? drawerPayload.currentCustomerStatus : undefined;
  const backToTaskId =
    drawerPayload?.type === "lead" ? drawerPayload.fromTaskId : undefined;
  const backToCustomerName =
    drawerPayload?.type === "lead" ? drawerPayload.fromCustomerName : undefined;
  const backToCustomerStatus =
    drawerPayload?.type === "lead" ? drawerPayload.fromCustomerStatus : undefined;
  const currentCustomerLead =
    task?.channel === "wecom" && currentCustomerName
      ? getLeadByName(currentCustomerName)
      : undefined;
  function openWecomApp() {
    if (typeof window === "undefined") return;
    window.location.href = "wxwork://";
    window.setTimeout(() => {
      toast.message("若未自动拉起企业微信，请确认已安装并允许协议唤起");
    }, 1200);
  }

  return (
    <Sheet open={drawerOpen} onOpenChange={(o) => !o && closeDrawer()}>
      <SheetContent className={drawerWidthClass}>
        <SheetHeader className="border-b px-6 py-4 text-left">
          <SheetTitle className="pr-8 leading-snug">{title}</SheetTitle>
          <SheetDescription className="text-left">
            {drawerPayload?.type === "task"
              ? "任务详情 · 列表上下文保留在左侧"
              : drawerPayload?.type === "customer"
                ? "客户中心 · 线索与任务"
              : drawerPayload?.type === "wecom_profile"
                ? "企微侧边栏 · 客户画像"
              : drawerPayload?.type === "wecom_image"
                ? "企微侧边栏 · 预览图"
              : "线索详情 · 列表上下文保留在左侧"}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {isWecomImageDrawer ? (
            <div className="mx-auto w-full max-w-[96%]">
              <img
                src="/qiyeweixin.png"
                alt="企微工作台预览图"
                className="w-full rounded-xl border border-border/60 object-contain shadow-sm"
              />
            </div>
          ) : null}
          {isWecomProfileDrawer ? (
            <div className="px-0 py-0">
              <WecomCustomerProfileClient
                leadId={drawerPayload.leadId}
                autoOpenFollow={drawerPayload.autoOpenFollow}
              />
            </div>
          ) : null}
          {isCustomerDrawer && drawerPayload?.type === "customer" ? (
            <CustomerCenterDrawerPanel
              follow_userid={drawerPayload.follow_userid}
              external_userid={drawerPayload.external_userid}
            />
          ) : null}
          {drawerPayload?.type === "lead" && leadId ? (
            <LeadDrawerPanel leadId={leadId} />
          ) : null}

          {isApiTask && drawerPayload?.type === "task" ? (
            <TaskDetailPanel
              taskId={drawerPayload.id}
              highlightTargetId={drawerPayload.apiTargetId}
            />
          ) : null}

          {drawerPayload?.type === "task" && !isApiTask && (task || isPhoneGroupTask) ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    (task?.status ?? "pending") === "overdue"
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {taskStatusLabel(task?.status ?? "pending")}
                </Badge>
                <Badge variant="outline">
                  {channelLabel(task?.channel ?? "phone")}
                </Badge>
              </div>
              {task?.channel === "wecom" && wecomDetail ? (
                <>
                  <dl className="grid gap-3 text-sm">
                    <div>
                      <dt className="text-muted-foreground">标签</dt>
                      <dd className="font-medium">{wecomDetail.tagLabel}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">当前客户</dt>
                      <dd className="font-medium">
                        {currentCustomerName ?? "—"}
                        {currentCustomerStatus ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {currentCustomerStatus === "done"
                              ? "已完成"
                              : currentCustomerStatus === "failed"
                                ? "发送失败"
                                : "未发送"}
                          </span>
                        ) : null}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">任务名称</dt>
                      <dd className="font-medium">{wecomDetail.title}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">截止时间</dt>
                      <dd className="font-medium">
                        {new Date(wecomDetail.dueAt).toLocaleString("zh-CN")}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">客户总数</dt>
                      <dd className="font-medium tabular-nums">
                        {wecomDetail.customerTotal}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">发送进度</dt>
                      <dd className="font-medium tabular-nums">
                        {wecomDetail.sentCount}/{wecomDetail.customerTotal}（
                        {wecomDetail.sendPercent}%）
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">发送内容</dt>
                      <dd className="mt-1 whitespace-pre-wrap rounded-md border border-border/60 bg-muted/30 p-3 text-sm leading-relaxed text-foreground">
                        {wecomDetail.sendContent}
                      </dd>
                    </div>
                    {wecomDetail.tagKind === "followup" ? (
                      <>
                        <div>
                          <dt className="text-muted-foreground">客户</dt>
                          <dd className="mt-1 text-sm">
                            {currentCustomerName ??
                              wecomDetail.pendingCustomers[0] ??
                              wecomDetail.doneCustomers[0] ??
                              "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">状态</dt>
                          <dd className="mt-1 text-sm">
                            {currentCustomerStatus === "done"
                              ? "已完成"
                              : currentCustomerStatus === "failed"
                                ? "发送失败"
                                : currentCustomerStatus === "pending"
                                  ? "未完成"
                                  : task.status === "done"
                                    ? "已完成"
                                    : "未完成"}
                          </dd>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <dt className="text-muted-foreground">未完成客户</dt>
                          <dd className="mt-1 text-sm">
                            {wecomDetail.pendingCustomers.length > 0
                              ? wecomDetail.pendingCustomers.join("、")
                              : "暂无"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">已完成客户</dt>
                          <dd className="mt-1 text-sm">
                            {wecomDetail.doneCustomers.length > 0
                              ? wecomDetail.doneCustomers.join("、")
                              : "暂无"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">发送失败客户</dt>
                          <dd className="mt-1 text-sm">
                            {wecomDetail.failedCustomers.length > 0
                              ? wecomDetail.failedCustomers.join("、")
                              : "暂无"}
                          </dd>
                        </div>
                      </>
                    )}
                    <div>
                      <dt className="text-muted-foreground">关联线索</dt>
                      <dd>{currentCustomerLead?.name ?? currentCustomerName ?? "—"}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <>
                  {isPhoneGroupTask && phoneGroupDetail ? (
                    <dl className="grid gap-3 text-sm">
                      <div>
                        <dt className="text-muted-foreground">分类任务</dt>
                        <dd className="font-medium">{phoneGroupDetail.bucketLabel}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">当前客户</dt>
                        <dd className="font-medium">{currentCustomerName ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">分类总客户数</dt>
                        <dd className="font-medium tabular-nums">
                          {phoneGroupDetail.customerTotal}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">逾期 / 未逾期</dt>
                        <dd className="font-medium tabular-nums">
                          {phoneGroupDetail.overdueCount} / {phoneGroupDetail.notOverdueCount}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">分类客户</dt>
                        <dd className="text-sm">
                          {phoneGroupDetail.customerNames.join("、")}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">关联线索</dt>
                        <dd>{displayLead?.name ?? currentCustomerName ?? "—"}</dd>
                      </div>
                    </dl>
                  ) : null}
                  {task?.description ? (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {task.description}
                    </p>
                  ) : null}
                  {!isPhoneGroupTask ? <dl className="grid gap-3 text-sm">
                    <div>
                      <dt className="text-muted-foreground">截止时间</dt>
                      <dd className="font-medium">
                        {new Date(task?.dueAt ?? "").toLocaleString("zh-CN")}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">关联线索</dt>
                      <dd>{displayLead?.name ?? "—"}</dd>
                    </div>
                  </dl> : null}
                </>
              )}

              <Separator />

              <div className="flex flex-col gap-2">
                {task?.channel === "phone" ? (
                  <>
                    <a
                      href={`tel:${(displayLead?.phone ?? "").replace(/\s/g, "")}`}
                      className={cn(
                        buttonVariants(),
                        "w-full justify-start gap-2"
                      )}
                      onClick={() => {
                        const ph = (displayLead?.phone ?? "").replace(/\s/g, "");
                        if (ph && leadId && /^\d+$/.test(String(leadId))) {
                          router.push(`/leads/${leadId}/edit?entry=phone`);
                        }
                      }}
                    >
                      <Phone className="size-4" />
                      拨打电话
                    </a>
                    {displayLead?.phone ? (
                      <p className="text-xs text-muted-foreground">
                        若未唤起拨号，请手动拨打：{displayLead.phone}
                      </p>
                    ) : null}
                  </>
                ) : null}
                {task && task.channel !== "wecom" && task.channel !== "phone" ? (
                  <p className="text-sm text-muted-foreground">
                    当前任务类型为「{channelLabel(task.channel)}
                    」，请在任务中心继续处理。
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t px-6 py-4">
          <div className="mb-2 flex flex-col gap-2 sm:flex-row">
            {drawerPayload?.type === "task" &&
            (task?.leadId || currentCustomerLead?.id || drawerPayload.currentLeadId) ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  if (task?.channel === "wecom" && currentCustomerLead?.id) {
                  openDrawer({
                    type: "lead",
                    id: currentCustomerLead.id,
                    fromTaskId: task.id,
                    fromCustomerName: currentCustomerName,
                    fromCustomerStatus: currentCustomerStatus,
                  });
                    return;
                  }
                  if (task?.leadId) {
                  openDrawer({
                    type: "lead",
                    id: task.leadId,
                    fromTaskId: task.id,
                  });
                    return;
                  }
                  if (drawerPayload.currentLeadId) {
                    openDrawer({
                      type: "lead",
                      id: drawerPayload.currentLeadId,
                      fromTaskId: drawerPayload.id,
                      fromCustomerName: currentCustomerName,
                      fromCustomerStatus: currentCustomerStatus,
                    });
                  }
                }}
              >
                查看关联线索
              </Button>
            ) : null}
            {drawerPayload?.type === "task" && task?.channel === "wecom" ? (
              <Button
                className="w-full justify-start gap-2 sm:justify-center"
                onClick={() => {
                  openWecomApp();
                }}
              >
                <MessageCircle className="size-4" />
                进入企微工作台跟进
                <ExternalLink className="ml-auto size-4 opacity-60 sm:hidden" />
              </Button>
            ) : null}
          </div>
          {drawerPayload?.type === "lead" && backToTaskId ? (
            <Button
              variant="outline"
              className="mb-2 w-full"
              onClick={() =>
                openDrawer({
                  type: "task",
                  id: backToTaskId,
                  currentCustomerName: backToCustomerName,
                  currentCustomerStatus: backToCustomerStatus,
                })
              }
            >
              返回任务详情
            </Button>
          ) : null}
          <Button variant="secondary" className="w-full" onClick={closeDrawer}>
            关闭
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
