import { create } from "zustand";

export type DrawerPayload =
  | {
      type: "lead";
      id: string;
      fromTaskId?: string;
      fromCustomerName?: string;
      fromCustomerStatus?:
        | "pending"
        | "in_progress"
        | "done"
        | "failed";
    }
  | {
      type: "task";
      id: string;
      phoneGroupKey?: string;
      currentLeadId?: string;
      currentCustomerName?: string;
      currentCustomerStatus?:
        | "pending"
        | "in_progress"
        | "done"
        | "failed";
      /** 后端任务详情的对象行 id（wecom_task_target.id） */
      apiTargetId?: string;
    }
  | {
      type: "wecom_profile";
      leadId?: string;
      autoOpenFollow?: boolean;
    }
  | {
      type: "wecom_image";
      leadId?: string;
    };

interface UiState {
  drawerOpen: boolean;
  drawerPayload: DrawerPayload | null;
  commandOpen: boolean;
  newTaskDialogOpen: boolean;
  openDrawer: (payload: DrawerPayload) => void;
  closeDrawer: () => void;
  setCommandOpen: (open: boolean) => void;
  setNewTaskDialogOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  drawerOpen: false,
  drawerPayload: null,
  commandOpen: false,
  newTaskDialogOpen: false,
  openDrawer: (payload) =>
    set({ drawerOpen: true, drawerPayload: payload }),
  closeDrawer: () => set({ drawerOpen: false, drawerPayload: null }),
  setCommandOpen: (open) => set({ commandOpen: open }),
  setNewTaskDialogOpen: (open) => set({ newTaskDialogOpen: open }),
}));
