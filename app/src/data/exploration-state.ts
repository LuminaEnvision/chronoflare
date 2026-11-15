import { isCivilDate, readingFor } from "./observations";
import type { ObservationSource, ObservationYear } from "./observations";
import { sampleRoles } from "./harmonization-pairs";
import type { SampleRole } from "./harmonization-pairs";

export function comparisonDay(search: string) {
  const value = new URLSearchParams(search).get("obs_compare_day");
  return value && /^\d{2}-\d{2}$/.test(value) && isCivilDate(`2000-${value}`)
    ? value
    : "08-01";
}
export function chartSelection(search: string) {
  const params = new URLSearchParams(search);
  const raw = params.get("pair_roles");
  const requested = raw?.split(",") ?? [];
  const roles: SampleRole[] =
    raw === "none"
      ? []
      : raw && requested.every((r) => sampleRoles.includes(r as SampleRole))
        ? sampleRoles.filter((r) => requested.includes(r))
        : [...sampleRoles];
  const date = params.get("pair_date") ?? "";
  return { roles, date: isCivilDate(date) ? date : "" };
}
export function chartRolesValue(roles: readonly SampleRole[]) {
  const ordered = sampleRoles.filter((r) => roles.includes(r));
  return ordered.length === sampleRoles.length
    ? ""
    : ordered.length
      ? ordered.join(",")
      : "none";
}
/** Explicit value navigation; never changes a requested gap automatically. */
export function adjacentValueDate(
  year: ObservationYear,
  source: ObservationSource,
  current: string,
  direction: "previous" | "next",
) {
  const dates = year.days
    .filter((day) => readingFor(day, source).value !== null)
    .map((day) => day.date);
  return direction === "next"
    ? (dates.find((day) => day > current) ?? null)
    : (dates.filter((day) => day < current).at(-1) ?? null);
}
