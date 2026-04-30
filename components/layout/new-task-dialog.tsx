"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { useUiStore } from "@/lib/store/ui-store";

export function NewTaskDialog() {
  const open = useUiStore((s) => s.newTaskDialogOpen);
  const setOpen = useUiStore((s) => s.setNewTaskDialogOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新建任务</DialogTitle>
          <DialogDescription>
            演示环境不会保存数据，提交后仅提示成功。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="task-title">标题</Label>
            <Input id="task-title" placeholder="例如：回访客户预算" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="task-note">备注</Label>
            <Textarea
              id="task-note"
              placeholder="可选"
              className="min-h-[80px] resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button
            onClick={() => {
              setOpen(false);
              toast.success("已创建任务（演示）");
            }}
          >
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
