import type { Dayjs } from "dayjs";

/**
 * 发给后端的东八区「墙钟」时间（无时区后缀）。
 * 与 `backend/time_util.parse_iso_datetime_cn` 约定一致：用户所选即为本地业务时间，不做 UTC 再换算。
 */
export function formatCnWallClockApi(d: Dayjs): string {
  if (!d || !d.isValid()) return "";
  return d.format("YYYY-MM-DDTHH:mm:ss");
}
