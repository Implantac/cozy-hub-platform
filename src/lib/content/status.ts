import { z } from "zod";

/** Delivery statuses belong to the scheduler, never to a manual editorial action. */
export const MANUAL_CONTENT_STATUSES = ["draft", "archived"] as const;
export const manualContentStatusSchema = z.enum(MANUAL_CONTENT_STATUSES);
export type ManualContentStatus = (typeof MANUAL_CONTENT_STATUSES)[number];
