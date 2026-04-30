"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { CommandMenu } from "@/components/layout/command-menu";
import { DetailDrawer } from "@/components/layout/detail-drawer";
import { GlobalHeader } from "@/components/layout/global-header";
import { NewTaskDialog } from "@/components/layout/new-task-dialog";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideGlobalHeader = pathname === "/wecom/customer-profile";

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex max-h-[100dvh] flex-col overflow-hidden">
        {hideGlobalHeader ? null : <GlobalHeader />}
        <main className="flex flex-1 flex-col overflow-auto bg-muted/30">
          <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8">
            {children}
          </div>
        </main>
      </SidebarInset>
      <DetailDrawer />
      <CommandMenu />
      <NewTaskDialog />
    </SidebarProvider>
  );
}
