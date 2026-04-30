"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BookUser, CheckSquare, PlusCircle } from "lucide-react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useUiStore } from "@/lib/store/ui-store";
import { searchEntities } from "@/lib/mock-data";

export function CommandMenu() {
  const router = useRouter();
  const commandOpen = useUiStore((s) => s.commandOpen);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const openDrawer = useUiStore((s) => s.openDrawer);
  const setNewTaskDialogOpen = useUiStore((s) => s.setNewTaskDialogOpen);

  const [query, setQuery] = React.useState("");

  const hits = React.useMemo(() => searchEntities(query), [query]);

  return (
    <CommandDialog
      open={commandOpen}
      onOpenChange={(open) => {
        setCommandOpen(open);
        if (!open) setQuery("");
      }}
      title="指令面板"
      description="搜索线索与任务，或执行快捷操作"
      showCloseButton
    >
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="搜索线索、任务…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>未找到匹配项</CommandEmpty>

          <CommandGroup heading="快捷操作">
            <CommandItem
              onSelect={() => {
                setCommandOpen(false);
                setNewTaskDialogOpen(true);
              }}
            >
              <PlusCircle className="size-4" />
              新建任务（演示）
            </CommandItem>
          </CommandGroup>

          {hits.length > 0 ? (
            <>
              <CommandSeparator alwaysRender />
              <CommandGroup heading="搜索结果">
                {hits.map((h) => (
                  <CommandItem
                    key={`${h.kind}-${h.id}`}
                    value={`${h.title} ${h.subtitle}`}
                    onSelect={() => {
                      setCommandOpen(false);
                      if (h.kind === "lead") {
                        openDrawer({ type: "lead", id: h.id });
                      } else {
                        openDrawer({ type: "task", id: h.id });
                      }
                    }}
                  >
                    {h.kind === "lead" ? (
                      <BookUser className="size-4" />
                    ) : (
                      <CheckSquare className="size-4" />
                    )}
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate">{h.title}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {h.subtitle}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          ) : null}

          <CommandSeparator alwaysRender />
          <CommandGroup heading="跳转">
            <CommandItem
              onSelect={() => {
                setCommandOpen(false);
                router.push("/panel");
              }}
            >
              工作面板
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCommandOpen(false);
                router.push("/tasks");
              }}
            >
              任务中心
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCommandOpen(false);
                router.push("/leads");
              }}
            >
              线索库
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
