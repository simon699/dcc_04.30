import { LeadList } from "@/components/leads/lead-list";

export default function LeadsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">线索库</h1>
        <p className="mt-1 text-muted-foreground">
          点击任意行从右侧打开线索详情，不离开当前列表。
        </p>
      </div>
      <LeadList />
    </div>
  );
}
