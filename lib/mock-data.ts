export type LeadStatus = "new" | "following" | "converted" | "lost";

/** 工作面板「跟进中线索」矩阵行分类（与业务队列对应，演示用） */
export type FollowBucketKey =
  | "priority"
  | "vertical_media"
  | "live_stream"
  | "new_lead"
  | "activation"
  | "revisit"
  | "outbound";

/** 可触达方式（演示）：仅电话 / 仅企微 / 双通道 */
export type LeadContactReach = "phone_only" | "wecom_only" | "both";

export interface Lead {
  id: string;
  name: string;
  company: string;
  phone: string;
  status: LeadStatus;
  owner: string;
  updatedAt: string;
  source?: string;
  /** 跟进中线索在工作面板矩阵中的分类 */
  followBucket?: FollowBucketKey;
  /** 默认可双通道；矩阵数量随「电话/企微」Tab 过滤 */
  contactReach?: LeadContactReach;
  /** 线索详情扩展字段（演示） */
  hasWecom?: boolean;
  createdAt?: string;
  nextFollowUpAt?: string;
  note?: string;
}

export type TaskChannel = "wecom" | "phone" | "email" | "visit";

export type TaskStatus = "pending" | "done" | "overdue";

export interface Task {
  id: string;
  title: string;
  channel: TaskChannel;
  status: TaskStatus;
  dueAt: string;
  leadId: string;
  description?: string;
}

export const MOCK_LEADS: Lead[] = [
  {
    id: "l1",
    name: "张伟",
    company: "星河制造",
    phone: "+8613800138000",
    status: "following",
    owner: "王销售",
    updatedAt: "2026-04-29T10:00:00",
    source: "官网留资",
    followBucket: "priority",
    contactReach: "both",
  },
  {
    id: "l2",
    name: "李娜",
    company: "云启科技",
    phone: "+8613911122233",
    status: "following",
    owner: "王销售",
    updatedAt: "2026-04-28T15:30:00",
    source: "展会",
    followBucket: "vertical_media",
    contactReach: "phone_only",
  },
  {
    id: "l3",
    name: "陈强",
    company: "远航物流",
    phone: "",
    status: "new",
    owner: "刘顾问",
    updatedAt: "2026-04-30T09:00:00",
    source: "渠道推荐",
  },
  {
    id: "l4",
    name: "赵敏",
    company: "慧算账财税",
    phone: "+8613555544433",
    status: "converted",
    owner: "王销售",
    updatedAt: "2026-04-20T11:00:00",
  },
  {
    id: "l5",
    name: "孙浩",
    company: "青松医疗",
    phone: "+8613660011222",
    status: "following",
    owner: "刘顾问",
    updatedAt: "2026-04-29T08:00:00",
    source: "企微群",
    followBucket: "live_stream",
    contactReach: "wecom_only",
  },
];

export const MOCK_TASKS: Task[] = [
  {
    id: "t1",
    title: "企微回复询价方案",
    channel: "wecom",
    status: "pending",
    dueAt: "2026-04-30T14:00:00",
    leadId: "l1",
    description: "发送 PDF 方案并确认预算区间",
  },
  {
    id: "t2",
    title: "电话确认上门演示时间",
    channel: "phone",
    status: "pending",
    dueAt: "2026-04-30T16:00:00",
    leadId: "l2",
    description: "与客户确认下周二上午档期",
  },
  {
    id: "t3",
    title: "企微发送合同草稿",
    channel: "wecom",
    status: "overdue",
    dueAt: "2026-04-29T18:00:00",
    leadId: "l5",
  },
  {
    id: "t4",
    title: "回访：上线培训满意度",
    channel: "phone",
    status: "pending",
    dueAt: "2026-05-02T10:00:00",
    leadId: "l4",
  },
  {
    id: "t5",
    title: "邮件发送白皮书",
    channel: "email",
    status: "pending",
    dueAt: "2026-05-01T12:00:00",
    leadId: "l3",
  },
  {
    id: "t6",
    title: "上门拜访：需求调研",
    channel: "visit",
    status: "pending",
    dueAt: "2026-05-05T09:30:00",
    leadId: "l2",
  },
  {
    id: "t7",
    title: "同步内部报价审批结果",
    channel: "wecom",
    status: "done",
    dueAt: "2026-04-30T11:30:00",
    leadId: "l1",
  },
  {
    id: "t8",
    title: "企微社群秒杀活动通知",
    channel: "wecom",
    status: "pending",
    dueAt: "2026-04-30T20:00:00",
    leadId: "l3",
    description: "向社群客户推送限时秒杀链接、库存与支付规则说明。",
  },
];

export function getLead(id: string): Lead | undefined {
  return MOCK_LEADS.find((l) => l.id === id);
}

export function getLeadByName(name: string): Lead | undefined {
  return MOCK_LEADS.find((l) => l.name === name);
}

export function getTask(id: string): Task | undefined {
  return MOCK_TASKS.find((t) => t.id === id);
}

export function getLeadName(id: string): string {
  return getLead(id)?.name ?? "—";
}

export function followingLeads(): Lead[] {
  return MOCK_LEADS.filter((l) => l.status === "following");
}

/** 面板矩阵行顺序与文案（与产品设计对齐） */
export const FOLLOWING_MATRIX_ROWS: {
  key: FollowBucketKey;
  label: string;
}[] = [
  { key: "priority", label: "优先任务" },
  { key: "vertical_media", label: "垂媒线索" },
  { key: "live_stream", label: "直播线索" },
  { key: "new_lead", label: "新线索" },
  { key: "activation", label: "激活线索" },
  { key: "revisit", label: "客户回访" },
  { key: "outbound", label: "临时外呼任务" },
];

export function getFollowBucketLabel(key: FollowBucketKey): string {
  return FOLLOWING_MATRIX_ROWS.find((r) => r.key === key)?.label ?? key;
}

/** 线索是否至少有一条「逾期」任务 */
export function leadHasOverdueTask(leadId: string): boolean {
  return MOCK_TASKS.some(
    (t) => t.leadId === leadId && t.status === "overdue"
  );
}

export function getLeadNearestOpenTaskDueAt(leadId: string): string {
  const nearest = [...MOCK_TASKS]
    .filter((t) => t.leadId === leadId && t.status !== "done")
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())[0];
  return nearest?.dueAt ?? getLead(leadId)?.updatedAt ?? new Date().toISOString();
}

/** 工作面板「电话 / 企微」Tab，与组件一致 */
export type ContactModeTab = "phone" | "wecom";

/** 当前 Tab 下该线索是否计入矩阵（电话：仅电话+双通道；企微：仅企微+双通道） */
export function leadMatchesContactMode(
  lead: Lead,
  mode: ContactModeTab
): boolean {
  const r = lead.contactReach ?? "both";
  if (r === "both") return true;
  if (r === "phone_only") return mode === "phone";
  if (r === "wecom_only") return mode === "wecom";
  return true;
}

export function contactReachLabel(r?: LeadContactReach): string {
  switch (r ?? "both") {
    case "phone_only":
      return "仅电话";
    case "wecom_only":
      return "仅企微";
    case "both":
      return "电话+企微";
    default:
      return "—";
  }
}

/** 各分类下跟进中线索：未逾期 / 逾期；数量随联系方式 Tab 变化 */
export function getFollowingLeadMatrix(mode: ContactModeTab): {
  key: FollowBucketKey;
  label: string;
  notOverdue: number;
  overdue: number;
}[] {
  const following = followingLeads();
  return FOLLOWING_MATRIX_ROWS.map(({ key, label }) => {
    const leads = following.filter(
      (l) => l.followBucket === key && leadMatchesContactMode(l, mode)
    );
    let notOverdue = 0;
    let overdue = 0;
    for (const lead of leads) {
      if (leadHasOverdueTask(lead.id)) overdue += 1;
      else notOverdue += 1;
    }
    return { key, label, notOverdue, overdue };
  });
}

/** 矩阵单元格：首个匹配线索 id（可选，用于快捷跳转） */
export function getFollowingLeadIdForCell(
  bucketKey: FollowBucketKey,
  overdue: boolean,
  mode: ContactModeTab
): string | undefined {
  for (const l of followingLeads()) {
    if (l.followBucket !== bucketKey) continue;
    if (leadHasOverdueTask(l.id) !== overdue) continue;
    if (!leadMatchesContactMode(l, mode)) continue;
    return l.id;
  }
  return undefined;
}

/** 矩阵单元格内跟进中线索（与当前 Tab 触达方式一致） */
export function getMatrixCellLeads(
  bucketKey: FollowBucketKey,
  overdue: boolean,
  mode: ContactModeTab
): Lead[] {
  return followingLeads().filter((l) => {
    if (l.followBucket !== bucketKey) return false;
    if (leadHasOverdueTask(l.id) !== overdue) return false;
    return leadMatchesContactMode(l, mode);
  });
}

export type IntentModel = "XC60" | "XC70" | "EM90" | "XC30";

export type LeadLevelGrade = "H级" | "A级" | "B级" | "C级" | "N级";
export type LeadModelYear = "2025款" | "2024款" | "2023款";

const INTENT_MODELS: IntentModel[] = ["XC60", "XC70", "EM90", "XC30"];
const LEVEL_GRADES: LeadLevelGrade[] = ["H级", "A级", "B级", "C级", "N级"];
const MODEL_YEARS: LeadModelYear[] = ["2025款", "2024款", "2023款"];
const YEAR_CONFIGS = ["四驱智远版", "长续航版", "豪华版", "智逸版", "旗舰版"];
const DEMO_REMARKS = [
  "意向较强，约周末到店",
  "对比竞品中，需报价单",
  "需置换评估",
  "企业采购流程较长",
  "再联络确认预算",
  "关注售后服务政策",
  "家人陪同二次到店",
];

function hashLeadId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** 演示用：按线索 id 稳定生成意向车型、等级、备注 */
export function getDemoLeadRowDisplay(lead: Lead): {
  intentModel: IntentModel;
  level: LeadLevelGrade;
  remark: string;
} {
  const h = hashLeadId(lead.id);
  return {
    intentModel: INTENT_MODELS[h % INTENT_MODELS.length],
    level: LEVEL_GRADES[h % LEVEL_GRADES.length],
    remark: DEMO_REMARKS[h % DEMO_REMARKS.length],
  };
}

export function getLeadDetailDisplay(lead: Lead): {
  hasWecom: boolean;
  createdAt: string;
  nextFollowUpAt: string;
  note: string;
  intentModel: IntentModel;
  modelYear: LeadModelYear;
  yearConfig: string;
  inviteStoreAt: string;
  nextContactAt: string;
} {
  const h = hashLeadId(lead.id);
  const baseTs = new Date(lead.updatedAt).getTime();
  const createdAt =
    lead.createdAt ??
    new Date(baseTs - (h % 20 + 1) * 86400000).toISOString();
  const nextFollowUpAt =
    lead.nextFollowUpAt ??
    new Date(baseTs + (h % 5 + 1) * 86400000).toISOString();
  const inviteStoreAt = new Date(
    new Date(nextFollowUpAt).getTime() + 2 * 86400000
  ).toISOString();
  const nextContactAt = new Date(
    new Date(nextFollowUpAt).getTime() + 6 * 3600000
  ).toISOString();

  return {
    hasWecom: lead.hasWecom ?? lead.contactReach !== "phone_only",
    createdAt,
    nextFollowUpAt,
    note: lead.note ?? DEMO_REMARKS[h % DEMO_REMARKS.length],
    intentModel: INTENT_MODELS[h % INTENT_MODELS.length],
    modelYear: MODEL_YEARS[h % MODEL_YEARS.length],
    yearConfig: YEAR_CONFIGS[h % YEAR_CONFIGS.length],
    inviteStoreAt,
    nextContactAt,
  };
}

export interface LeadFollowRecord {
  id: string;
  at: string;
  channel: "phone" | "wecom" | "visit";
  content: string;
}

export function getLeadFollowRecords(leadId: string): LeadFollowRecord[] {
  const lead = getLead(leadId);
  if (!lead) return [];
  const h = hashLeadId(leadId);
  const now = new Date(lead.updatedAt).getTime();
  const records: LeadFollowRecord[] = [
    {
      id: `${leadId}-r1`,
      at: new Date(now - (h % 4 + 1) * 3600000).toISOString(),
      channel: "wecom",
      content: `已向${lead.name}发送方案摘要，等待确认预算区间。`,
    },
    {
      id: `${leadId}-r2`,
      at: new Date(now - (h % 2 + 1) * 86400000).toISOString(),
      channel: "phone",
      content: "电话沟通需求场景，约定下次联系时间。",
    },
    {
      id: `${leadId}-r3`,
      at: new Date(now - (h % 3 + 3) * 86400000).toISOString(),
      channel: "visit",
      content: "初步邀约到店试驾，客户表示可排期。",
    },
  ];
  return records.sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );
}

/** 所选分类下、存在未完成「电话」任务的线索（外呼演示对象） */
export function getFollowingLeadsWithOpenPhoneTask(
  bucketKeys: Iterable<FollowBucketKey>
): Lead[] {
  const keys = new Set(bucketKeys);
  const seen = new Set<string>();
  const out: Lead[] = [];
  for (const lead of followingLeads()) {
    if (!lead.followBucket || !keys.has(lead.followBucket)) continue;
    const hasPhone = MOCK_TASKS.some(
      (t) =>
        t.leadId === lead.id &&
        t.channel === "phone" &&
        t.status !== "done"
    );
    if (!hasPhone || seen.has(lead.id)) continue;
    seen.add(lead.id);
    out.push(lead);
  }
  return out;
}

/** 已勾选分类下的「跟进中」线索（去重；并按电话/企微可触达过滤） */
export function getFollowingLeadsInBuckets(
  bucketKeys: Iterable<FollowBucketKey>,
  mode: ContactModeTab
): Lead[] {
  const keys = new Set(bucketKeys);
  const out: Lead[] = [];
  const seen = new Set<string>();
  for (const lead of followingLeads()) {
    if (!lead.followBucket || !keys.has(lead.followBucket)) continue;
    if (!leadMatchesContactMode(lead, mode)) continue;
    if (seen.has(lead.id)) continue;
    seen.add(lead.id);
    out.push(lead);
  }
  return out;
}

export interface PhoneGroupTaskDetail {
  bucketKey: FollowBucketKey;
  bucketLabel: string;
  customerTotal: number;
  overdueCount: number;
  notOverdueCount: number;
  leadIds: string[];
  customerNames: string[];
}

export function getPhoneGroupTaskDetail(
  bucketKey: FollowBucketKey
): PhoneGroupTaskDetail {
  const leads = followingLeads().filter(
    (l) => l.followBucket === bucketKey && leadMatchesContactMode(l, "phone")
  );
  const overdueCount = leads.filter((l) => leadHasOverdueTask(l.id)).length;
  const notOverdueCount = leads.length - overdueCount;
  return {
    bucketKey,
    bucketLabel: getFollowBucketLabel(bucketKey),
    customerTotal: leads.length,
    overdueCount,
    notOverdueCount,
    leadIds: leads.map((l) => l.id),
    customerNames: leads.map((l) => l.name),
  };
}

export interface TodayCallLogEntry {
  id: string;
  leadId?: string;
  timeLabel: string;
  name: string;
  phone: string;
  durationLabel: string;
  result: string;
}

export function getInitialTodayCallLogs(): TodayCallLogEntry[] {
  return [
    {
      id: "log-1",
      timeLabel: "09:42",
      name: "张伟",
      phone: "+8613800138000",
      durationLabel: "3分12秒",
      result: "已接通",
    },
    {
      id: "log-2",
      timeLabel: "10:18",
      name: "李娜",
      phone: "+8613911122233",
      durationLabel: "1分05秒",
      result: "未接通",
    },
    {
      id: "log-3",
      timeLabel: "11:03",
      name: "回访-赵敏",
      phone: "+8613555544433",
      durationLabel: "4分40秒",
      result: "已接通",
    },
  ];
}

export function pendingTasksSorted(): Task[] {
  return [...MOCK_TASKS]
    .filter((t) => t.status !== "done")
    .sort(
      (a, b) =>
        new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
    );
}

/** 未完成企微任务，按截止时间升序 */
export function pendingWecomTasksSorted(): Task[] {
  return pendingTasksSorted().filter((t) => t.channel === "wecom");
}

/** 演示：企微任务标签（按任务 id 稳定映射为群发 / 跟进） */
export type WecomTaskTagKind = "mass" | "followup";

export function hashTaskId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function wecomTaskDisplayTag(taskId: string): {
  kind: WecomTaskTagKind;
  label: string;
} {
  const kind: WecomTaskTagKind =
    hashTaskId(taskId) % 2 === 0 ? "mass" : "followup";
  return {
    kind,
    label: kind === "mass" ? "群发任务" : "跟进任务",
  };
}

const WECOM_DEMO_CUSTOMER_NAMES = [
  "张伟",
  "李娜",
  "陈强",
  "赵敏",
  "孙浩",
];

function pickDemoCustomerNames(
  seed: number,
  count: number,
  salt: number
): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const idx =
      Math.abs(seed * 17 + i * 23 + salt * 41) % WECOM_DEMO_CUSTOMER_NAMES.length;
    const base = WECOM_DEMO_CUSTOMER_NAMES[idx];
    out.push(base);
  }
  return out;
}

/** 工作面板侧拉：企微发送任务完整演示字段 */
export interface WecomTaskPanelDetail {
  tagLabel: string;
  tagKind: WecomTaskTagKind;
  title: string;
  dueAt: string;
  customerTotal: number;
  sentCount: number;
  sendPercent: number;
  sendContent: string;
  pendingCustomers: string[];
  doneCustomers: string[];
  failedCustomers: string[];
}

export function getWecomTaskPanelDetail(task: Task): WecomTaskPanelDetail {
  const { label: tagLabel, kind: tagKind } = wecomTaskDisplayTag(task.id);
  const seed = hashTaskId(task.id);
  const leadName = getLead(task.leadId)?.name ?? WECOM_DEMO_CUSTOMER_NAMES[seed % WECOM_DEMO_CUSTOMER_NAMES.length];

  if (tagKind === "followup") {
    const isDone = task.status === "done";
    const pendingCustomers = isDone ? [] : [leadName];
    const doneCustomers = isDone ? [leadName] : [];
    const failedCustomers: string[] = [];
    const customerTotal = 1;
    const sentCount = doneCustomers.length;
    const sendPercent = isDone ? 100 : 0;
    const baseContent =
      task.description ??
      "（演示）请根据客户最新反馈进行一对一跟进沟通。";

    return {
      tagLabel,
      tagKind,
      title: task.title,
      dueAt: task.dueAt,
      customerTotal,
      sentCount,
      sendPercent,
      sendContent: `${baseContent}\n\n跟进说明：该任务固定关联单一客户，按节点完成跟进（演示）。`,
      pendingCustomers,
      doneCustomers,
      failedCustomers,
    };
  }

  const customerTotal = Math.max(5, 15 + (seed % 26));
  const failedCount = Math.min(4, seed % 5);
  const targetSent = Math.round(
    customerTotal * (0.22 + ((seed * 7) % 55) / 100)
  );
  const sentCount = Math.min(
    Math.max(0, customerTotal - failedCount),
    Math.max(0, targetSent)
  );
  const pendingN = customerTotal - sentCount - failedCount;

  const sendPercent =
    customerTotal > 0
      ? Math.round((sentCount / customerTotal) * 100)
      : 0;

  const baseContent =
    task.description ??
    "（演示）请根据客户分层发送话术，注意频次与合规提示。";
  const sendContent =
    tagKind === "mass"
      ? `${baseContent}\n\n群发说明：客户名单来自 CRM 今日切片；支持点击查看送达明细；失败自动进入补发队列（演示）。`
      : `${baseContent}\n\n跟进说明：按会话优先级排序；已读未回客户将推送二次提醒（演示）。`;

  const doneCustomers = pickDemoCustomerNames(seed, sentCount, 1);
  const failedCustomers = pickDemoCustomerNames(seed, failedCount, 2);
  const pendingCustomers = pickDemoCustomerNames(seed, pendingN, 3);

  return {
    tagLabel,
    tagKind,
    title: task.title,
    dueAt: task.dueAt,
    customerTotal,
    sentCount,
    sendPercent,
    sendContent,
    pendingCustomers,
    doneCustomers,
    failedCustomers,
  };
}

/** 未完成企微任务拆成未逾期 / 已逾期（均按截止时间升序） */
export function splitPendingWecomTasksByOverdue(): {
  notOverdue: Task[];
  overdue: Task[];
} {
  const all = pendingWecomTasksSorted();
  return {
    notOverdue: all.filter((t) => t.status !== "overdue"),
    overdue: all.filter((t) => t.status === "overdue"),
  };
}

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** 以本地日历「今日」为截止日期的任务与线索 KPI（演示数据按机器日期统计）。 */
export function getTodayKpis(referenceDate: Date = new Date()) {
  const tasksToday = MOCK_TASKS.filter((t) =>
    isSameCalendarDay(new Date(t.dueAt), referenceDate)
  );

  const leadsNeedFollowUp = new Set(
    tasksToday.filter((t) => t.status !== "done").map((t) => t.leadId)
  ).size;

  const taskTotalToday = tasksToday.length;
  const doneToday = tasksToday.filter((t) => t.status === "done").length;
  const undoneToday = tasksToday.filter((t) => t.status !== "done").length;

  return {
    leadsNeedFollowUp,
    taskTotalToday,
    doneToday,
    undoneToday,
  };
}

export type SearchHit =
  | { kind: "lead"; id: string; title: string; subtitle: string }
  | { kind: "task"; id: string; title: string; subtitle: string };

export function searchEntities(query: string): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const hits: SearchHit[] = [];

  for (const lead of MOCK_LEADS) {
    const hay = `${lead.name} ${lead.company} ${lead.phone}`.toLowerCase();
    if (hay.includes(q)) {
      hits.push({
        kind: "lead",
        id: lead.id,
        title: lead.name,
        subtitle: `${lead.company} · ${lead.phone}`,
      });
    }
  }

  for (const task of MOCK_TASKS) {
    const lead = getLead(task.leadId);
    const hay = `${task.title} ${lead?.name ?? ""}`.toLowerCase();
    if (hay.includes(q)) {
      hits.push({
        kind: "task",
        id: task.id,
        title: task.title,
        subtitle: `${channelLabel(task.channel)} · ${lead?.name ?? ""}`,
      });
    }
  }

  return hits.slice(0, 12);
}

export function channelLabel(c: TaskChannel): string {
  switch (c) {
    case "wecom":
      return "企微";
    case "phone":
      return "电话";
    case "email":
      return "邮件";
    case "visit":
      return "拜访";
    default:
      return c;
  }
}

export function leadStatusLabel(s: LeadStatus): string {
  switch (s) {
    case "new":
      return "新线索";
    case "following":
      return "跟进中";
    case "converted":
      return "已转化";
    case "lost":
      return "已流失";
    default:
      return s;
  }
}

export function taskStatusLabel(s: TaskStatus): string {
  switch (s) {
    case "pending":
      return "待办";
    case "done":
      return "已完成";
    case "overdue":
      return "已逾期";
    default:
      return s;
  }
}
