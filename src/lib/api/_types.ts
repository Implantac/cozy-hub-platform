/**
 * Centralized type aliases derived from server function return shapes.
 *
 * Importing these in UI code keeps components in sync with the actual
 * server contracts and eliminates `any` at the call sites.
 */
import type { listBrands } from "./brands.functions";
import type { listChannels } from "./channels.functions";
import type { listContent } from "./content.functions";
import type { listMissions } from "./missions.functions";
import type { listSchedulerJobs } from "./scheduler.functions";
import type {
  listMemories,
  listRecommendations,
} from "./brain.functions";
import type { getDashboard } from "./dashboard.functions";

type Unwrap<T> = T extends Promise<infer U> ? U : T;
type ListItem<F> = F extends (...args: unknown[]) => unknown
  ? Unwrap<ReturnType<F>> extends Array<infer I>
    ? I
    : never
  : never;

export type Brand = ListItem<typeof listBrands>;
export type Channel = ListItem<typeof listChannels>;
export type Content = ListItem<typeof listContent>;
export type Mission = ListItem<typeof listMissions>;
export type SchedulerJob = ListItem<typeof listSchedulerJobs>;
export type Recommendation = ListItem<typeof listRecommendations>;
export type Memory = ListItem<typeof listMemories>;
export type Dashboard = Unwrap<ReturnType<typeof getDashboard>>;
