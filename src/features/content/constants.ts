export type ContentStatus = "draft" | "scheduled" | "published" | "archived";

export const STATUSES: readonly ContentStatus[] = ["draft", "scheduled", "published", "archived"] as const;
export const FILTERS = ["all", ...STATUSES] as const;
export type FilterValue = (typeof FILTERS)[number];

export const STATUS_STYLES: Record<ContentStatus, string> = {
  draft: "bg-secondary text-secondary-foreground",
  scheduled: "bg-primary/15 text-primary",
  published: "bg-success/15 text-success",
  archived: "bg-muted text-muted-foreground",
};
