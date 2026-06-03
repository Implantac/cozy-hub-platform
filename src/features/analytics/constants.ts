const TOOLTIP_STYLE = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
  boxShadow: "var(--shadow-card)",
} as const;

export const DAYS_OPTIONS = [7, 30, 90] as const;
export type DaysOption = (typeof DAYS_OPTIONS)[number];

export { TOOLTIP_STYLE };
