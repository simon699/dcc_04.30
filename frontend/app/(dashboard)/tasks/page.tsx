import { TaskTable } from "@/components/tasks/task-table";

export default function TasksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">任务中心</h1>
        <p className="mt-1 text-muted-foreground">
          仅展示电话与企微任务；企微任务按客户展开展示，点击任务可看汇总详情。
        </p>
      </div>
      <TaskTable />
    </div>
  );
}
