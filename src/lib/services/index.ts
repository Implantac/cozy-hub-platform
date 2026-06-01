/**
 * USE OS — Service Layer
 *
 * Single import surface for every domain. Routes and components should
 * import service namespaces from this barrel rather than from individual
 * `*.functions.ts` files, so the underlying backend can be swapped by
 * editing this file alone.
 *
 * Convention:
 *   - Trivial pass-through services are re-exported here directly
 *     (`export * as XService from "@/lib/api/x.functions"`).
 *   - Services that reshape or compose the underlying API live in their
 *     own file (`brain.service.ts`, `dashboard.service.ts`).
 */

// --- Reshaping / composing services --------------------------------------
export * as BrainService from "./brain.service";
export * as DashboardService from "./dashboard.service";

// --- Pass-through service namespaces -------------------------------------
export * as AnalyticsService from "@/lib/api/analytics.functions";
export * as BrainCoreService from "@/lib/api/brain-core.functions";
export * as BrandsService from "@/lib/api/brands.functions";
export * as ChannelsService from "@/lib/api/channels.functions";
export * as CoachService from "@/lib/api/coach.functions";
export * as ContentService from "@/lib/api/content.functions";
export * as DecisionOSService from "@/lib/api/decision-os.functions";
export * as HealthService from "@/lib/api/health.functions";
export * as LearningService from "@/lib/api/learning.functions";
export * as MissionsService from "@/lib/api/missions.functions";
export * as NavigatorService from "@/lib/api/navigator.functions";
export * as OpportunitiesService from "@/lib/api/opportunities.functions";
export * as SchedulerService from "@/lib/api/scheduler.functions";
export * as ScoreService from "@/lib/api/score.functions";
export * as TrustOSService from "@/lib/api/trust-os.functions";
export * as WorkspaceService from "@/lib/api/workspaces.functions";
