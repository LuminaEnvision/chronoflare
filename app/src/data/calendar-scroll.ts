/** Width of the sticky year column in the activity calendar. */
export const YEAR_LABEL_WIDTH = 45;

/**
 * Horizontal scroll position that reveals a day beside the sticky year labels.
 * Returns the current position when the day is already fully visible.
 */
export function scrollLeftToRevealDay(input: {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
  dayLeftInView: number;
  dayWidth: number;
  gutter?: number;
}) {
  const gutter = input.gutter ?? YEAR_LABEL_WIDTH;
  const max = Math.max(0, input.scrollWidth - input.clientWidth);
  const dayOffset = input.scrollLeft + input.dayLeftInView;
  const visibleStart = input.scrollLeft + gutter;
  const visibleEnd = input.scrollLeft + input.clientWidth;
  const dayEnd = dayOffset + input.dayWidth;
  if (dayOffset >= visibleStart && dayEnd <= visibleEnd)
    return input.scrollLeft;
  const visibleWidth = Math.max(0, input.clientWidth - gutter);
  const centered = dayOffset + input.dayWidth / 2 - gutter - visibleWidth / 2;
  return Math.min(max, Math.max(0, centered));
}
