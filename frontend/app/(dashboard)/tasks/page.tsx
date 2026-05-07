import { TaskTable } from "@/components/tasks/task-table";

export default function TasksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">任务中心</h1>
        <p className="mt-1 text-muted-foreground">
          数据来自后台任务表；按任务对象（客户）展开展示，点击任务名称查看详情。
        </p>
      </div>
      <TaskTable />
    </div>
  );
}
