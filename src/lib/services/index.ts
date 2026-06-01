/**
 * USE OS — Service Layer
 * ----------------------------------------------------------------------
 * Thin abstraction over data fetching. Today every service forwards to
 * a TanStack server function backed by Supabase. Tomorrow these same
 * symbols can be swapped for HTTP calls to an external Python / FastAPI
 * "AI Brain" backend with NO changes required in components.
 *
 *   Component  ──►  Service interface  ──►  Server fn  ──►  Supabase
 *                                       │
 *                                       └──►  (future) HTTP client ──► FastAPI
 *
 * Rules:
 *   - Components import from `@/lib/services/...`, never from `*.functions`.
 *   - Service modules MUST keep stable input / output contracts.
 *   - Backend swap = replace the function body only.
 * ----------------------------------------------------------------------
 */

export * as DashboardService from "./dashboard.service";
export * as ContentService from "./content.service";
export * as SchedulerService from "./scheduler.service";
export * as BrainService from "./brain.service";
export * as BrandsService from "./brands.service";
export * as ChannelsService from "./channels.service";
export * as MissionsService from "./missions.service";
export * as AnalyticsService from "./analytics.service";
export * as WorkspaceService from "./workspace.service";
