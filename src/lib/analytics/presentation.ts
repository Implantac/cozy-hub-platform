function localeFor(language: string) {
  return language.toLowerCase().startsWith("en") ? "en-US" : "pt-BR";
}

export function formatMetric(value: number, language: string) {
  return Number.isFinite(value) ? new Intl.NumberFormat(localeFor(language)).format(value) : "—";
}

/** A captured UTC calendar date must not shift to the previous day in Brazil. */
export function formatCollectionDate(day: string, language: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
  const date = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day) return day;
  return new Intl.DateTimeFormat(localeFor(language), {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}
