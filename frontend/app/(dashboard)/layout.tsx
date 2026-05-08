import { AntdProvider } from "@/components/antd-provider";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AntdProvider>
      <DashboardShell>{children}</DashboardShell>
    </AntdProvider>
  );
}
