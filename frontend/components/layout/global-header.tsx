"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useUiStore } from "@/lib/store/ui-store";

const titles: Record<string, string> = {
  "/panel": "工作面板",
  "/tasks": "任务中心",
  "/leads": "线索库",
  "/customers": "客户中心",
  "/rules": "设置",
  "/wecom": "企微工作台",
};

export function GlobalHeader() {
  const pathname = usePathname();
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [setCommandOpen]);

  const title =
    titles[pathname] ??
    (pathname.startsWith("/wecom") ? "企微工作台" : "线索运营");

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6">
      <SidebarTrigger className="-ml-1" aria-label="切换侧边栏" />
      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList className="flex-nowrap">
          <BreadcrumbItem className="hidden sm:inline-block">
            <BreadcrumbLink href="/panel">首页</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="hidden sm:inline-block" />
          <BreadcrumbItem className="min-w-0">
            <BreadcrumbPage className="truncate font-medium">{title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="hidden h-8 gap-2 text-muted-foreground md:inline-flex"
          onClick={() => setCommandOpen(true)}
          aria-label="打开指令面板"
        >
          <Search className="size-4" aria-hidden />
          <span className="text-xs">搜索</span>
          <kbd className="pointer-events-none ml-1 hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium lg:inline">
            ⌘K
          </kbd>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setCommandOpen(true)}
          aria-label="打开搜索"
        >
          <Search className="size-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
            aria-label="通知中心"
          >
            <Bell className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>通知</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="flex flex-col items-start gap-0.5 py-2">
              <span className="font-medium">任务即将到期</span>
              <span className="text-xs text-muted-foreground">
                「企微回复询价方案」，明日 14:00 截止
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-0.5 py-2">
              <span className="font-medium">新线索分配</span>
              <span className="text-xs text-muted-foreground">
                青松医疗 · 孙浩 已分配给你
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="justify-center text-muted-foreground">
              全部为演示数据
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
