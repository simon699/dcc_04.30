import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { WecomCustomerProfileClient } from "./wecom-customer-profile-client";

export default async function WecomCustomerProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string; followUserid?: string }>;
}) {
  const { leadId, followUserid } = await searchParams;
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-md space-y-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <WecomCustomerProfileClient leadId={leadId} followUserid={followUserid} />
    </Suspense>
  );
}
