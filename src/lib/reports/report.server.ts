/**
 * VELT — Weekly report service (server-only).
 *
 * Fetches the rows, hands them to the pure builder, renders the PDF. Three rules
 * shape the queries:
 *
 *   1. **Read with the user's session, not the service role.** A report is the
 *      workspace's own data; RLS already enforces who may see it. The service
 *      role is the escape hatch for anonymous surfaces, and this is not one.
 *   2. **Two windows, one round trip each.** The comparison is the product here —
 *      a report without "vs. last week" is a dashboard screenshot.
 *   3. **Empty is a valid answer.** A workspace with no activity gets a one-page
 *      report that says so, not an error and not a PDF full of zeros.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { throwIfError } from "@/lib/api/_supabase";
import {
  buildReportData,
  defaultWindows,
  reportToCsv,
  type PostMetrics,
  type PublishedPost,
  type ReportWindow,
  type WeeklyReportData,
} from "./weekly";
import { renderWeeklyReportPdf } from "./render";

export interface ReportBundle {
  data: WeeklyReportData;
  pdf: Uint8Array;
  csv: string;
}

async function fetchPublished(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  window: ReportWindow,
): Promise<PublishedPost[]> {
  // A "publication" is a scheduler job that actually succeeded against a
  // platform API — not a draft, and not a failed attempt that will be retried.
  const { data, error } = await supabase
    .from("scheduler_jobs")
    .select("content_id, channel_id, scheduled_at, status, channels(platform)")
    .eq("workspace_id", workspaceId)
    .eq("status", "succeeded")
    .gte("scheduled_at", window.start)
    .lt("scheduled_at", window.end)
    .order("scheduled_at", { ascending: true })
    .limit(500);
  throwIfError(error);

  const contentIds = [
    ...new Set((data ?? []).map((r) => r.content_id).filter(Boolean)),
  ] as string[];
  const titles = new Map<string, string | null>();
  if (contentIds.length > 0) {
    const { data: contents } = await supabase
      .from("content")
      .select("id, title")
      .in("id", contentIds);
    for (const c of contents ?? []) titles.set(c.id, c.title);
  }

  return (data ?? []).map((r) => ({
    contentId: String(r.content_id ?? ""),
    title: r.content_id ? (titles.get(r.content_id) ?? null) : null,
    platform: platformOf(r),
    publishedAt: String(r.scheduled_at),
  }));
}

/** `channels` arrives as a joined object; Supabase types it loosely. */
function platformOf(row: Record<string, unknown>): string {
  const ch = row.channels as { platform?: string } | { platform?: string }[] | null;
  if (Array.isArray(ch)) return String(ch[0]?.platform ?? "desconhecido");
  return String(ch?.platform ?? "desconhecido");
}

async function fetchMetrics(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  window: ReportWindow,
): Promise<PostMetrics[]> {
  // Latest snapshot per content inside the window. Summing every snapshot would
  // multiply a post's numbers by the number of times it was collected.
  const { data, error } = await supabase
    .from("analytics_snapshots")
    .select("content_id, metrics, captured_at")
    .eq("workspace_id", workspaceId)
    .gte("captured_at", window.start)
    .lt("captured_at", window.end)
    .order("captured_at", { ascending: false })
    .limit(2000);
  throwIfError(error);

  const latest = new Map<string, Record<string, number>>();
  for (const row of data ?? []) {
    if (!row.content_id || latest.has(row.content_id)) continue;
    const m = (row.metrics ?? {}) as Record<string, unknown>;
    const clean: Record<string, number> = {};
    for (const [k, v] of Object.entries(m)) {
      const n = Number(v);
      if (Number.isFinite(n)) clean[k] = n;
    }
    latest.set(row.content_id, clean);
  }

  return [...latest.entries()].map(([contentId, metrics]) => ({ contentId, metrics }));
}

/**
 * Builds one report. `windows` is injectable so the same function serves the
 * weekly job, an on-demand export, and the tests.
 */
export async function buildWeeklyReport(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  opts: { now?: Date; windows?: { window: ReportWindow; previousWindow: ReportWindow } } = {},
): Promise<ReportBundle> {
  const windows = opts.windows ?? defaultWindows(opts.now ?? new Date());

  const { data: ws, error: wsErr } = await supabase
    .from("workspaces")
    .select("name")
    .eq("id", workspaceId)
    .maybeSingle();
  throwIfError(wsErr);

  const [published, metricsCurrent, metricsPrevious] = await Promise.all([
    fetchPublished(supabase, workspaceId, {
      start: windows.previousWindow.start,
      end: windows.window.end,
    }),
    fetchMetrics(supabase, workspaceId, windows.window),
    fetchMetrics(supabase, workspaceId, windows.previousWindow),
  ]);

  const data = buildReportData({
    workspaceName: ws?.name ?? "Meu workspace",
    window: windows.window,
    previousWindow: windows.previousWindow,
    published,
    metricsCurrent,
    metricsPrevious,
    now: windows.window.end,
  });

  const pdf = await renderWeeklyReportPdf(data, { workspaceName: data.workspaceName });

  return { data, pdf, csv: reportToCsv(data) };
}

/** `relatorio-semanal-2026-10-28.pdf` — sortable and safe on every filesystem. */
export function reportFilename(data: WeeklyReportData, ext: "pdf" | "csv"): string {
  const day = data.window.end.slice(0, 10);
  return `relatorio-semanal-${day}.${ext}`;
}
