/** Smallest "round" axis maximum at or above a value: 1, 2, 2.5 or 5 times a power of ten. */
export function niceCeiling(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10])
    if (step * power >= value * (1 - 1e-12)) return step * power;
  return 10 * power;
}
