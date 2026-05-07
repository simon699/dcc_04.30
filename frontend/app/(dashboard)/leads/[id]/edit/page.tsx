"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getDemoLeadRowDisplay,
  getLead,
  getLeadDetailDisplay,
  type LeadLevelGrade,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type Level = LeadLevelGrade;

function formatDateTimeInput(dateLike: string): string {
  const d = new Date(dateLike);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

export default function LeadEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const entry = search.get("entry");
  const leadId = params?.id ?? "";
  const lead = getLead(leadId);

  const demo = React.useMemo(
    () => (lead ? getDemoLeadRowDisplay(lead) : null),
    [lead]
  );
  const detail = React.useMemo(
    () => (lead ? getLeadDetailDisplay(lead) : null),
    [lead]
  );

  const [intentModel, setIntentModel] = React.useState(demo?.intentModel ?? "");
  const [modelYear, setModelYear] = React.useState<string>(
    detail?.modelYear ?? "2025款"
  );
  const [yearConfig, setYearConfig] = React.useState(detail?.yearConfig ?? "");
  const [nextFollow, setNextFollow] = React.useState(
    detail ? formatDateTimeInput(detail.nextFollowUpAt) : ""
  );
  const [nextContact, setNextContact] = React.useState(
    detail ? formatDateTimeInput(detail.nextContactAt) : ""
  );
  const [inviteDate, setInviteDate] = React.useState(
    detail ? formatDateTimeInput(detail.inviteStoreAt) : ""
  );
  const [level, setLevel] = React.useState<Level>(demo?.level ?? "B级");
  const [note, setNote] = React.useState(detail?.note ?? "");

  React.useEffect(() => {
    if (!lead) return;
    if (entry === "phone" && lead.phone) {
      toast.message(`已进入电话跟进模式：${lead.name}`);
    }
    if (entry === "edit") {
      toast.message(`已进入编辑模式：${lead.name}`);
    }
  }, [entry, lead]);

  if (!lead || !demo || !detail) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">编辑线索</h1>
        <p className="text-sm text-muted-foreground">未找到该线索。</p>
        <Button variant="outline" onClick={() => router.push("/leads")}>
          返回线索库
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">编辑线索</h1>
          <p className="mt-1 text-muted-foreground">
            更新线索信息并完成本次跟进处理（演示保存）。
          </p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          返回
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">客户信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold">{lead.name}</span>
            <Badge variant="secondary">{lead.phone ? lead.phone.replace(/^\+86/, "") : "无手机号"}</Badge>
            <Badge variant={detail.hasWecom ? "default" : "outline"}>
              {detail.hasWecom ? "已加微" : "未加微"}
            </Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <p>
              <span className="text-muted-foreground">线索产生时间：</span>
              {new Date(detail.createdAt).toLocaleString("zh-CN")}
            </p>
            <p>
              <span className="text-muted-foreground">下次跟进时间：</span>
              {new Date(detail.nextFollowUpAt).toLocaleString("zh-CN")}
            </p>
            <p>
              <span className="text-muted-foreground">归属人：</span>
              {lead.owner}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">客户跟进信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="intentModel">意向车型</Label>
              <Input
                id="intentModel"
                value={intentModel}
                onChange={(e) => setIntentModel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="modelYear">车型年款</Label>
              <Input
                id="modelYear"
                value={modelYear}
                onChange={(e) => setModelYear(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="yearConfig">年款配置</Label>
              <Input
                id="yearConfig"
                value={yearConfig}
                onChange={(e) => setYearConfig(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="inviteDate">邀约到店日期</Label>
              <Input
                id="inviteDate"
                type="datetime-local"
                value={inviteDate}
                onChange={(e) => setInviteDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nextFollow">下次跟进时间</Label>
              <Input
                id="nextFollow"
                type="datetime-local"
                value={nextFollow}
                onChange={(e) => setNextFollow(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nextContact">下次联系时间</Label>
              <Input
                id="nextContact"
                type="datetime-local"
                value={nextContact}
                onChange={(e) => setNextContact(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>客户等级</Label>
            <div className="flex flex-wrap gap-2">
              {(["H级", "A级", "B级", "C级", "N级"] as Level[]).map((lv) => (
                <Button
                  key={lv}
                  type="button"
                  size="sm"
                  variant={level === lv ? "default" : "outline"}
                  onClick={() => setLevel(lv)}
                >
                  {lv}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">备注信息</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => router.push("/leads")}>
              返回线索库
            </Button>
            <Button
              onClick={() => {
                toast.success("线索信息已保存（演示）");
              }}
            >
              保存并完成跟进
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
