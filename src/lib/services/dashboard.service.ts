import { getDashboard } from "@/lib/api/dashboard.functions";

/** Read the workspace operational overview (KPIs + panels). */
export const fetchOverview = (workspaceId: string) =>
  getDashboard({ data: { workspaceId } });

export type DashboardOverview = Awaited<ReturnType<typeof fetchOverview>>;
