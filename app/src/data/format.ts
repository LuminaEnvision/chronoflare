/** Keep generated labels in English regardless of the developer's OS locale. */
export function formatMetric(value: number | null) {
  return value === null
    ? "Not available"
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(
        value,
      );
}

export function formatDate(value: string) {
  return new Date(value + "T12:00:00Z").toLocaleDateString("en-US", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Present known state without treating an unknown method as validated coverage. */
export function formatCoverageMethod(method: string) {
  switch (method.trim()) {
    case "pending_scientific_review":
      return "Awaiting scientific review";
    case "unknown":
    case "undetermined":
      return "Coverage not established";
    case "":
      return "Not specified";
    default:
      return "See dataset manifest";
  }
}
