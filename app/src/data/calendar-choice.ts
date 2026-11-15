import { isCivilDate, observationSelection, readingFor } from "./observations";
import type {
  ObservationManifest,
  ObservationSource,
  ObservationYear,
} from "./observations";

/** The same month and day in another year; February 29 falls back to February 28. */
export function sameDayInYear(date: string, year: number | string) {
  const candidate = `${year}-${date.slice(5)}`;
  return isCivilDate(candidate) ? candidate : `${year}-02-28`;
}

/**
 * The date with a value closest to a target date, earlier on a tie. Used only after
 * the person switches year in the controls: a date requested by a link is never moved.
 */
export function nearestValueDate(
  year: ObservationYear,
  source: ObservationSource,
  target: string,
) {
  const at = (date: string) => Date.parse(`${date}T12:00:00Z`);
  let best: string | null = null;
  for (const day of year.days) {
    if (readingFor(day, source).value === null) continue;
    if (
      best === null ||
      Math.abs(at(day.date) - at(target)) < Math.abs(at(best) - at(target))
    )
      best = day.date;
  }
  return best;
}

/** Query string that states what the calendar actually shows, for a link it had to adjust. */
export function coherentSearch(search: string, manifest: ObservationManifest) {
  const params = new URLSearchParams(search);
  const { year, source, date, compareYear } = observationSelection(
    search,
    manifest,
  );
  if (params.has("obs_year")) params.set("obs_year", String(year));
  if (params.has("obs_source")) params.set("obs_source", source);
  if (params.has("obs_date")) params.set("obs_date", date);
  if (params.has("obs_compare")) {
    if (compareYear === null) params.delete("obs_compare");
    else params.set("obs_compare", String(compareYear));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}
