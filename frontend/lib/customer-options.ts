import { asTrimmedString, formatHttpApiDetail } from "@/lib/utils";

export type CustomerOption = {
  external_userid: string;
  phone: string | null;
  label: string;
};

export async function fetchCustomerOptions(followUserid: string): Promise<CustomerOption[]> {
  const fu = asTrimmedString(followUserid) || "ShiFengwei";
  const q = new URLSearchParams({ follow_userid: fu, limit: "500" });
  const r = await fetch(`/api/customers/options?${q}`);
  let json: unknown;
  try {
    json = await r.json();
  } catch {
    throw new Error(`HTTP ${r.status}`);
  }
  if (!r.ok) throw new Error(formatHttpApiDetail(json));
  const body = json as { items?: CustomerOption[] };
  return body.items ?? [];
}
