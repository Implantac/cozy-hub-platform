export const MISSION_COLS = ["pending", "in_progress", "done"] as const;
export type MissionStatus = (typeof MISSION_COLS)[number];
