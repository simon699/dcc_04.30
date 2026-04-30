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
  getLeadDetailDisplay,
  getLeadFollowRecords,
  getLead,
  getLeadByName,
  getPhoneGroupTaskDetail,
  getTask,
  getWecomTaskPanelDetail,
  leadStatusLabel,
  taskStatusLabel,
} from "@/lib/mock-data";
import { useUiStore } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function DetailDrawer() {
  const router = useRouter();
  const drawerOpen = useUiStore((s) => s.drawerOpen);
  const drawerPayload = useUiStore((s) => s.drawerPayload);
  const closeDrawer = useUiStore((s) => s.closeDrawer);
  const openDrawer = useUiStore((s) => s.openDrawer);

  const task =
    drawerPayload?.type === "task" ? getTask(drawerPayload.id) : undefined;
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
        : undefined;

  const displayLead = leadId ? getLead(leadId) : undefined;

  const title =
    drawerPayload?.type === "lead"
      ? displayLead?.name ?? "线索"
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
  const leadDetail = displayLead ? getLeadDetailDisplay(displayLead) : null;
  const leadFollowRecords = displayLead ? getLeadFollowRecords(displayLead.id) : [];

  return (
    <Sheet open={drawerOpen} onOpenChange={(o) => !o && closeDrawer()}>
      <SheetContent className="flex h-full w-full max-w-full flex-col gap-0 p-0 sm:!w-[50vw] sm:!max-w-[50vw]">
        <SheetHeader className="border-b px-6 py-4 text-left">
          <SheetTitle className="pr-8 leading-snug">{title}</SheetTitle>
          <SheetDescription className="text-left">
            {drawerPayload?.type === "task"
              ? "任务详情 · 列表上下文保留在左侧"
              : "线索详情 · 列表上下文保留在左侧"}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {drawerPayload?.type === "lead" && displayLead ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold">{displayLead.name}</h3>
                  <Badge variant="secondary">
                    {leadStatusLabel(displayLead.status)}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{displayLead.phone}</p>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <p>
                    <span className="text-muted-foreground">是否加微信：</span>
                    {leadDetail?.hasWecom ? "已加微" : "未加微"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">线索产生时间：</span>
                    {new Date(leadDetail?.createdAt ?? "").toLocaleString("zh-CN")}
                  </p>
                  <p>
                    <span className="text-muted-foreground">下次跟进时间：</span>
                    {new Date(leadDetail?.nextFollowUpAt ?? "").toLocaleString("zh-CN")}
                  </p>
                </div>
                <p className="mt-2 text-sm">
                  <span className="text-muted-foreground">备注：</span>
                  {leadDetail?.note ?? "—"}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {displayLead.phone ? (
                    <button
                      type="button"
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "gap-1"
                      )}
                      onClick={() => {
                        closeDrawer();
                        router.push(`/leads/${displayLead.id}/edit?entry=phone`);
                      }}
                    >
                      <Phone className="size-4" />
                      电话
                    </button>
                  ) : (
                    <span
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "pointer-events-none gap-1 text-muted-foreground opacity-60"
                      )}
                    >
                      <Phone className="size-4" />
                      无手机号
                    </span>
                  )}
                  {leadDetail?.hasWecom ? (
                    <Button
                      size="sm"
                      onClick={() =>
                        toast.message(`打开与 ${displayLead.name} 的微信会话（演示）`)
                      }
                    >
                      微信
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-dashed"
                      onClick={() =>
                        toast.message(`向 ${displayLead.name} 发起加微（演示）`)
                      }
                    >
                      加微
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      closeDrawer();
                      router.push(`/leads/${displayLead.id}/edit?entry=edit`);
                    }}
                  >
                    编辑线索
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast.message(`分配 ${displayLead.name} 线索（演示）`)}
                  >
                    分配线索
                  </Button>
                </div>
              </div>

              <Tabs defaultValue="detail" className="w-full">
                <TabsList variant="line" className="w-full justify-start bg-transparent p-0">
                  <TabsTrigger value="detail" className="px-3 py-2">
                    详情
                  </TabsTrigger>
                  <TabsTrigger value="records" className="px-3 py-2">
                    跟进记录
                  </TabsTrigger>
                  <TabsTrigger value="profile" className="px-3 py-2">
                    客户画像
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="detail" className="mt-3">
                  <dl className="grid gap-3 text-sm">
                    <div>
                      <dt className="text-muted-foreground">意向车型</dt>
                      <dd className="font-medium">{leadDetail?.intentModel ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">车型年款</dt>
                      <dd>{leadDetail?.modelYear ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">年款配置</dt>
                      <dd>{leadDetail?.yearConfig ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">邀约到店日期</dt>
                      <dd>{new Date(leadDetail?.inviteStoreAt ?? "").toLocaleString("zh-CN")}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">下次联系时间</dt>
                      <dd>{new Date(leadDetail?.nextContactAt ?? "").toLocaleString("zh-CN")}</dd>
                    </div>
                  </dl>
                </TabsContent>
                <TabsContent value="records" className="mt-3">
                  <ul className="space-y-3">
                    {leadFollowRecords.map((r) => (
                      <li key={r.id} className="relative pl-5">
                        <span className="absolute left-0 top-1.5 size-2 rounded-full bg-primary" />
                        <div className="text-xs text-muted-foreground">
                          {new Date(r.at).toLocaleString("zh-CN")} · {channelLabel(r.channel)}
                        </div>
                        <p className="mt-1 text-sm">{r.content}</p>
                      </li>
                    ))}
                  </ul>
                </TabsContent>
                <TabsContent value="profile" className="mt-3">
                  <p className="text-sm text-muted-foreground">暂无客户画像</p>
                </TabsContent>
              </Tabs>
            </div>
          ) : null}

          {drawerPayload?.type === "task" && (task || isPhoneGroupTask) ? (
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
          {drawerPayload?.type === "task" && task?.channel === "wecom" ? (
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                className="w-full"
                onClick={() => {
                  toast.success(
                    `已对${currentCustomerName ?? "当前客户"}发起发送（演示）`
                  );
                }}
              >
                对当前人发送
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  const unsentCount = wecomDetail?.pendingCustomers.length ?? 0;
                  toast.success(`已向 ${unsentCount} 位未发送客户发起发送（演示）`);
                }}
              >
                未发送的都发送
              </Button>
            </div>
          ) : null}
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
                  closeDrawer();
                  router.push(`/wecom?taskId=${task.id}`);
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
