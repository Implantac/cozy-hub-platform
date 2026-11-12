/** Browser-local datetime input -> an unambiguous UTC instant. Never treat a past/invalid date as now. */
export function futureScheduleIso(value: string, now = Date.now()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const time = new Date(value);
  if (!Number.isFinite(time.getTime()) || time.getTime() <= now) return null;
  // Date normalizes nonexistent dates (Feb 30) and DST gaps. Reject instead of silently moving the schedule.
  if (localDateTime(time) !== value) return null;
  return time.toISOString();
}
export function localDateTime(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export interface SchedulingOptions {
  contents: Array<{ id: string; title: string | null; status: string }>;
  channels: Array<{
    id: string;
    platform: string;
    handle: string | null;
    status: string;
    eligible: boolean;
    reason: string;
  }>;
}
