import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { WecomWorkbenchClient } from "./wecom-client";

export default function WecomPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full max-w-2xl" />
        </div>
      }
    >
      <WecomWorkbenchClient />
    </Suspense>
  );
}
