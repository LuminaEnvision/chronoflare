/** Fixed logarithmic FRP color scale: one warm hue, light to dark, 0 to 100,000+ MW. */
export const frpScaleMaximum = 100000;
export const frpScaleTicks = [10, 100, 1000, 10000, 100000] as const;
const stops: [number, number, number][] = [
  [255, 243, 214],
  [253, 208, 144],
  [246, 158, 84],
  [224, 100, 44],
  [176, 52, 28],
  [112, 26, 20],
];

/** Position of a value on the scale, from 0 to 1. Larger values saturate at 1. */
export function frpIntensity(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(1, Math.log1p(value) / Math.log1p(frpScaleMaximum));
}

export function frpColor(value: number) {
  const position = frpIntensity(value) * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(position));
  const share = position - index;
  const channel = (c: number) =>
    Math.round(
      stops[index][c] + (stops[index + 1][c] - stops[index][c]) * share,
    );
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

/** Relative luminance of an `rgb(r, g, b)` color, for legibility checks. */
export function luminance(color: string) {
  const [r, g, b] = color
    .match(/\d+/g)!
    .map(Number)
    .map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
