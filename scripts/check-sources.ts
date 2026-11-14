import { gibsTileUrl } from "../app/src/data/gibs";

// Explicit opt-in network check; CI remains reproducible without NASA access.
const url = gibsTileUrl("2025-09-01")
  .replace("{z}", "5")
  .replace("{y}", "17")
  .replace("{x}", "11");
const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
if (
  !response.ok ||
  !response.headers.get("content-type")?.includes("image/jpeg")
) {
  throw Error(`NASA GIBS imagery check failed (HTTP ${response.status})`);
}
const bytes = new Uint8Array(await response.arrayBuffer());
if (bytes[0] !== 0xff || bytes[1] !== 0xd8)
  throw Error("GIBS did not return a JPEG");
console.log(
  `NASA GIBS: sample JPEG received (${bytes.length} bytes). This does not establish fire-data coverage.`,
);
console.log(
  "NASA FIRMS: offline client ready; live download requires a local FIRMS_MAP_KEY and an explicit request.",
);
