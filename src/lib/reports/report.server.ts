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
import { readAllPages } from "@/lib/api/_pagination";
import { readSnapshotWindow } from "@/lib/analytics/read.server";
import { latestSnapshots, cleanMetrics } from "@/lib/analytics/snapshots";

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
  const data = await readAllPages((from, to) =>
    supabase
      .from("scheduler_jobs")
      .select(
        "id, content_id, channel_id, updated_at, status, external_post_id, channels(platform), content(title)",
      )
      .eq("workspace_id", workspaceId)
      .eq("status", "succeeded")
      .not("external_post_id", "is", null)
      .neq("external_post_id", "")
      .not("external_post_id", "like", "sim\\_%")
      .gte("updated_at", window.start)
      .lt("updated_at", window.end)
      .order("updated_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
  );
  return data.map((r) => ({
    contentId: r.content_id,
    channelId: r.channel_id,
    title: r.content?.title ?? null,
    platform: platformOf(r),
    publishedAt: r.updated_at,
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
  const rows = await readSnapshotWindow(supabase, workspaceId, window);
  return latestSnapshots(rows).map((row) => ({
    contentId: row.content_id!,
    channelId: row.channel_id!,
    platform: row.channel?.platform ?? "other",
    title: row.content?.title ?? null,
    metrics: cleanMetrics(row.metrics),
  }));
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
  if (!ws) throw new Error("Workspace não encontrado ou acesso não permitido.");

  const [published, metricsCurrent, metricsPrevious] = await Promise.all([
    fetchPublished(supabase, workspaceId, {
      start: windows.previousWindow.start,
      end: windows.window.end,
    }),
    fetchMetrics(supabase, workspaceId, windows.window),
    fetchMetrics(supabase, workspaceId, windows.previousWindow),
  ]);

  const data = buildReportData({
    workspaceName: ws.name,
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
