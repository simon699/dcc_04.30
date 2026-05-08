"use client";

import * as React from "react";
import { MessageCircle, Pencil, Phone } from "lucide-react";
import { toast } from "sonner";
import { env as wecomEnv } from "@wecom/jssdk";

import {
  CreateLeadSheet,
  type CreateLeadPrefill,
} from "@/components/leads/create-lead-sheet";
import {
  CreateWecomTaskSheet,
  type CreateWecomTaskPrefill,
} from "@/components/tasks/create-wecom-task-sheet";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUiStore } from "@/lib/store/ui-store";
import { tryOpenWecomExternalUserChat } from "@/lib/wecom-open-chat";
import { asTrimmedString, cn, formatHttpApiDetail } from "@/lib/utils";

export type CustomerProfileApi = {
  external_userid: string;
  follow_userid: string;
  follow_row_id: number | null;
  display_name: string;
  phone: string | null;
  remark: string | null;
  avatar: string | null;
  corp_name: string | null;
  position: string | null;
  tags_json: string | null;
  tag_id_json: string | null;
  external_profile?: {
    name: string | null;
    type: number | null;
    gender: number | null;
  } | null;
};

type LeadRow = {
  id: string;
  phone: string | null;
  customer_name: string | null;
  intent_model: string | null;
  customer_level: string | null;
  created_at: string | null;
};

type ApiTaskRow = {
  row_id: string;
  task: {
    id: string;
    name: string;
    status: string;
    deadline: string | null;
    task_type: string;
    channel: string;
    creator_userid: string;
  };
  target: {
    id: number;
    status: string;
    target_external_userid: string | null;
    target_phone: string | null;
    target_lead_id?: string | null;
  };
  target_display_name?: string;
};

function taskStatusLabel(st: string, deadline: string | null): string {
  if (st === "done" || st === "cancelled") {
    return st === "done" ? "已完成" : "已取消";
  }
  if (deadline) {
    const d = new Date(deadline);
    if (!Number.isNaN(d.getTime()) && d.getTime() < Date.now()) {
      return "已逾期";
    }
  }
  if (st === "in_progress") return "进行中";
  return "待办";
}

function targetStatusLabel(s: string): string {
  switch (s) {
    case "pending":
      return "待处理";
    case "in_progress":
      return "进行中";
    case "done":
      return "已完成";
    case "failed":
      return "失败";
    default:
      return s;
  }
}

function mapTargetForDrawer(
  s: string
): "pending" | "in_progress" | "done" | "failed" {
  if (s === "done") return "done";
  if (s === "failed") return "failed";
  if (s === "in_progress") return "in_progress";
  return "pending";
}

function isTaskRowCompleted(row: ApiTaskRow): boolean {
  const st = row.task.status;
  if (st === "done" || st === "cancelled") return true;
  const tg = row.target.status;
  if (tg === "done" || tg === "failed") return true;
  return false;
}

type Props = {
  follow_userid: string;
  external_userid: string;
};

export function CustomerCenterDrawerPanel({ follow_userid, external_userid }: Props) {
  const openDrawer = useUiStore((s) => s.openDrawer);
  const [profile, setProfile] = React.useState<CustomerProfileApi | null>(null);
  const [profileErr, setProfileErr] = React.useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = React.useState(true);

  const [leads, setLeads] = React.useState<LeadRow[]>([]);
  const [loadingLeads, setLoadingLeads] = React.useState(false);
  const [tasks, setTasks] = React.useState<ApiTaskRow[]>([]);
  const [loadingTasks, setLoadingTasks] = React.useState(false);

  const [createLeadOpen, setCreateLeadOpen] = React.useState(false);
  const [createLeadPrefill, setCreateLeadPrefill] = React.useState<CreateLeadPrefill>({});
  const [taskSheetOpen, setTaskSheetOpen] = React.useState(false);
  const [taskPrefill, setTaskPrefill] = React.useState<CreateWecomTaskPrefill>({});

  const [editOpen, setEditOpen] = React.useState(false);
  const [editPhone, setEditPhone] = React.useState("");
  const [openingWecom, setOpeningWecom] = React.useState(false);

  const ext = asTrimmedString(external_userid);
  const fu = asTrimmedString(follow_userid);

  const loadProfile = React.useCallback(async () => {
    if (!ext) return;
    setLoadingProfile(true);
    setProfileErr(null);
    try {
      const q = new URLSearchParams({
        follow_userid: fu,
        external_userid: ext,
      });
      const r = await fetch(`/api/customers/profile?${q}`);
      let json: unknown;
      try {
        json = await r.json();
      } catch {
        throw new Error(`HTTP ${r.status}`);
      }
      if (!r.ok) throw new Error(formatHttpApiDetail(json));
      setProfile(json as CustomerProfileApi);
    } catch (e) {
      setProfile(null);
      setProfileErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingProfile(false);
    }
  }, [ext, fu]);

  const loadLeads = React.useCallback(async () => {
    if (!ext) return;
    setLoadingLeads(true);
    try {
      const q = new URLSearchParams({
        external_userid: ext,
        page: "1",
        page_size: "50",
      });
      const r = await fetch(`/api/leads/by-external?${q}`);
      const json = (await r.json()) as { items?: LeadRow[] };
      if (!r.ok) throw new Error(formatHttpApiDetail(json));
      setLeads(json.items ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      setLeads([]);
    } finally {
      setLoadingLeads(false);
    }
  }, [ext]);

  const loadTasks = React.useCallback(async () => {
    if (!ext) return;
    setLoadingTasks(true);
    try {
      const q = new URLSearchParams({
        page: "1",
        page_size: "50",
        target_external_userid: ext,
      });
      const r = await fetch(`/api/task-rows?${q}`);
      const json = (await r.json()) as { items?: ApiTaskRow[] };
      if (!r.ok) throw new Error(formatHttpApiDetail(json));
      setTasks(json.items ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      setTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  }, [ext]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProfile();
  }, [loadProfile]);

  React.useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    void loadLeads();
    void loadTasks();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [loadLeads, loadTasks]);

  function displayNameFromProfile(p: CustomerProfileApi): string {
    return asTrimmedString(p.display_name) || asTrimmedString(p.external_userid);
  }

  function targetLabel(row: ApiTaskRow): string {
    const n = asTrimmedString(row.target_display_name);
    if (n && n !== "—") return n;
    const e = asTrimmedString(row.target.target_external_userid);
    const ph = asTrimmedString(row.target.target_phone);
    if (e) return e;
    if (ph) return ph;
    return "—";
  }

  const openTaskRows = React.useMemo(
    () => tasks.filter((r) => !isTaskRowCompleted(r)),
    [tasks]
  );
  const doneTaskRows = React.useMemo(
    () => tasks.filter((r) => isTaskRowCompleted(r)),
    [tasks]
  );

  async function savePhone() {
    if (!profile) return;
    try {
      const r = await fetch("/api/customers/phone", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          follow_userid: profile.follow_userid,
          external_userid: profile.external_userid,
          phone: editPhone.trim() === "" ? "" : editPhone.trim(),
        }),
      });
      let json: unknown;
      try {
        json = await r.json();
      } catch {
        throw new Error(`HTTP ${r.status}`);
      }
      if (!r.ok) throw new Error(formatHttpApiDetail(json));
      toast.success("手机号已保存");
      setEditOpen(false);
      await loadProfile();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  if (loadingProfile && !profile && !profileErr) {
    return (
      <div className="space-y-3 text-sm text-muted-foreground">加载客户信息…</div>
    );
  }

  if (profileErr && !profile) {
    return (
      <p className="text-sm text-destructive whitespace-pre-wrap">{profileErr}</p>
    );
  }

  if (!profile) return null;

  const name = displayNameFromProfile(profile);
  const phoneRaw = asTrimmedString(profile.phone);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex gap-3">
            {profile.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar}
                alt=""
                className="size-14 shrink-0 rounded-full bg-muted object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                头像
              </div>
            )}
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg leading-tight">{name}</CardTitle>
              <CardDescription className="mt-1 line-clamp-2">
                {profile.corp_name || "—"}
                {profile.position ? ` · ${profile.position}` : ""}
              </CardDescription>
              <p className="mt-2 font-mono text-xs text-muted-foreground break-all">
                {profile.external_userid}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {phoneRaw ? (
              <a
                href={`tel:${phoneRaw.replace(/\s/g, "")}`}
                className={cn(buttonVariants({ size: "sm" }), "gap-1")}
              >
                <Phone className="size-3.5" />
                电话
              </a>
            ) : (
              <Button size="sm" variant="outline" disabled className="gap-1">
                <Phone className="size-3.5" />
                无手机号
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              className="gap-1"
              disabled={openingWecom}
              onClick={async () => {
                const eid = asTrimmedString(profile.external_userid);
                if (!eid) return;
                setOpeningWecom(true);
                try {
                  const r = await tryOpenWecomExternalUserChat({
                    externalUserid: eid,
                    internalUserid: profile.follow_userid,
                  });
                  if (r.ok) return;
                  if (wecomEnv.isWeCom) {
                    toast.error(r.message ?? "无法打开会话");
                    return;
                  }
                  openDrawer({ type: "wecom_image" });
                } finally {
                  setOpeningWecom(false);
                }
              }}
            >
              <MessageCircle className="size-3.5" />
              {openingWecom ? "打开中…" : "企微"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => {
                setEditPhone(profile.phone ?? "");
                setEditOpen(true);
              }}
            >
              <Pencil className="size-3.5" />
              手机号
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setCreateLeadPrefill({
                  phone: phoneRaw,
                  external_userid: profile.external_userid,
                  customer_name: name,
                  follow_userid: profile.follow_userid,
                });
                setCreateLeadOpen(true);
              }}
            >
              创建线索
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setTaskPrefill({
                  targets: [
                    {
                      target_external_userid: profile.external_userid,
                      ...(phoneRaw ? { target_phone: phoneRaw } : {}),
                    },
                  ],
                });
                setTaskSheetOpen(true);
              }}
            >
              创建任务
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="leads" className="w-full">
        <TabsList variant="line" className="w-full justify-start bg-transparent p-0">
          <TabsTrigger value="leads" className="px-3 py-2">
            线索
          </TabsTrigger>
          <TabsTrigger value="tasks" className="px-3 py-2">
            任务
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="mt-3 space-y-2">
          {loadingLeads ? (
            <p className="text-sm text-muted-foreground">加载线索…</p>
          ) : leads.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无关联线索</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>客户</TableHead>
                  <TableHead className="hidden sm:table-cell">意向</TableHead>
                  <TableHead className="w-[100px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <div className="font-medium">
                        {asTrimmedString(l.customer_name) || "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {l.phone ?? "无手机"}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-sm sm:table-cell">
                      {l.intent_model ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="link"
                        className="h-auto px-0"
                        onClick={() =>
                          openDrawer({
                            type: "lead",
                            id: l.id,
                          })
                        }
                      >
                        详情
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="mt-3 space-y-4">
          {loadingTasks ? (
            <p className="text-sm text-muted-foreground">加载任务…</p>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无任务对象</p>
          ) : (
            <>
              {openTaskRows.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    未完成
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>任务</TableHead>
                        <TableHead className="hidden sm:table-cell">对象</TableHead>
                        <TableHead className="w-[88px] text-right sm:text-left">
                          状态
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {openTaskRows.map((row) => {
                        const t = row.task;
                        const tg = row.target;
                        return (
                          <TableRow key={row.row_id}>
                            <TableCell>
                              <button
                                type="button"
                                className="text-left font-medium underline decoration-primary/30 underline-offset-4"
                                onClick={() =>
                                  openDrawer({
                                    type: "task",
                                    id: t.id,
                                    apiTargetId: String(tg.id),
                                    currentCustomerName: targetLabel(row),
                                    currentCustomerStatus: mapTargetForDrawer(tg.status),
                                  })
                                }
                              >
                                {t.name}
                              </button>
                              <div className="text-xs text-muted-foreground">
                                {taskStatusLabel(t.status, t.deadline)}
                              </div>
                            </TableCell>
                            <TableCell className="hidden max-w-[140px] truncate text-sm sm:table-cell">
                              {targetLabel(row)}
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground sm:text-left">
                              {targetStatusLabel(tg.status)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
              {doneTaskRows.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    已完成
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>任务</TableHead>
                        <TableHead className="hidden sm:table-cell">对象</TableHead>
                        <TableHead className="w-[88px] text-right sm:text-left">
                          状态
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {doneTaskRows.map((row) => {
                        const t = row.task;
                        const tg = row.target;
                        return (
                          <TableRow key={row.row_id}>
                            <TableCell>
                              <button
                                type="button"
                                className="text-left font-medium underline decoration-primary/30 underline-offset-4"
                                onClick={() =>
                                  openDrawer({
                                    type: "task",
                                    id: t.id,
                                    apiTargetId: String(tg.id),
                                    currentCustomerName: targetLabel(row),
                                    currentCustomerStatus: mapTargetForDrawer(tg.status),
                                  })
                                }
                              >
                                {t.name}
                              </button>
                              <div className="text-xs text-muted-foreground">
                                {taskStatusLabel(t.status, t.deadline)}
                              </div>
                            </TableCell>
                            <TableCell className="hidden max-w-[140px] truncate text-sm sm:table-cell">
                              {targetLabel(row)}
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground sm:text-left">
                              {targetStatusLabel(tg.status)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={(o) => !o && setEditOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑手机号</DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {profile.external_userid}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="cust-drawer-phone">手机号</Label>
            <Input
              id="cust-drawer-phone"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              autoComplete="tel"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void savePhone()}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateLeadSheet
        open={createLeadOpen}
        onOpenChange={setCreateLeadOpen}
        prefill={createLeadPrefill}
        lockCustomer
        onSuccess={() => {
          void loadLeads();
          void loadProfile();
        }}
        formId="customer-drawer-lead"
        customerFollowUserid={fu}
      />
      <CreateWecomTaskSheet
        open={taskSheetOpen}
        onOpenChange={setTaskSheetOpen}
        prefill={taskPrefill}
        onSuccess={() => void loadTasks()}
        formId="customer-drawer-task"
        customerFollowUserid={fu}
      />
    </div>
  );
}
