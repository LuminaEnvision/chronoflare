import { z } from "zod";
import { landCoverClasses } from "./mapbiomas-reference";

export { landCoverClasses };
export const LAND_COVER_YEAR = 2020;
export const LAND_COVER_COLLECTION = 11;
export const LAND_COVER_ASSET =
  "projects/mapbiomas-public/assets/brazil/lulc/collection11/mapbiomas_brazil_collection11_coverage_v3";
export const LAND_COVER_SUBTHEME = "coverage_coverage-30m-droufo";
const LEGEND = "coverage-bypu14";
const SUBTHEME_ID = "9782794d-9836-4de5-988a-46416ef9be06";
const API = "https://prd.plataforma.mapbiomas.org/api/v1/brazil/";
export const LAND_COVER_VIEWER =
  "https://plataforma.mapbiomas.org/projects/mapbiomas/brazil?" +
  new URLSearchParams({
    "tl[themeKey]": "coverage",
    "tl[subthemeKey]": LAND_COVER_SUBTHEME,
    "tl[legendKey]": LEGEND,
    "tl[year]": String(LAND_COVER_YEAR),
    "t[regionKey]": "brazil",
    "t[ids][]": "1-4-6",
    "t[divisionCategoryId]": "4",
  }).toString();

const definitionSchema = z.object({
  subthemes: z.array(
    z.object({
      id: z.string(),
      key: z.string(),
      visibility: z.string(),
      dataType: z.string(),
      badges: z.array(z.string()),
      asset: z.object({
        assetId: z.string(),
        bandFormat: z.string(),
        scale: z.number(),
        years: z.array(z.number().int()),
      }),
    }),
  ),
});
type ProviderClass = {
  pixelValue: number;
  color: string;
  name: { "en-US": string };
  children: ProviderClass[];
};
const providerClass: z.ZodType<ProviderClass> = z.lazy(() =>
  z.object({
    pixelValue: z.number().int(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    name: z.object({ "en-US": z.string() }),
    children: z.array(providerClass).default([]),
  }),
);
const legendSchema = z.object({
  legend: z.object({
    key: z.string(),
    subthemeId: z.string(),
    visibility: z.string(),
    items: z.array(providerClass),
  }),
});

/** Fail closed if the provider silently changes the pinned product or its legend. */
export function validateLandCoverDefinition(
  definition: unknown,
  legend: unknown,
) {
  const subtheme = definitionSchema
    .parse(definition)
    .subthemes.find((item) => item.key === LAND_COVER_SUBTHEME);
  if (
    !subtheme ||
    subtheme.id !== SUBTHEME_ID ||
    subtheme.visibility !== "public" ||
    subtheme.dataType !== "annual" ||
    !subtheme.badges.includes("col. 11") ||
    subtheme.asset.assetId !== LAND_COVER_ASSET ||
    subtheme.asset.scale !== 30 ||
    subtheme.asset.bandFormat !== "classification_{year}" ||
    !subtheme.asset.years.includes(LAND_COVER_YEAR)
  )
    throw Error(
      "The provider's land-cover product has changed. This context layer needs review.",
    );
  const data = legendSchema.parse(legend).legend;
  if (
    data.key !== LEGEND ||
    data.subthemeId !== SUBTHEME_ID ||
    data.visibility !== "public"
  )
    throw Error("The provider's land-cover legend has changed.");
  const leaves: { value: number; label: string; color: string }[] = [];
  const walk = (items: ProviderClass[]) => {
    for (const item of items) {
      if (item.children.length) walk(item.children);
      else
        leaves.push({
          value: item.pixelValue,
          label: item.name["en-US"].trim(),
          color: item.color.toLowerCase(),
        });
    }
  };
  walk(data.items);
  const expected = landCoverClasses.map((item) => ({
    ...item,
    color: item.color.toLowerCase(),
  }));
  const sort = (items: typeof leaves) =>
    items.sort((a, b) => a.value - b.value);
  if (JSON.stringify(sort(leaves)) !== JSON.stringify(sort(expected)))
    throw Error(
      "The provider's land-cover classes have changed. The layer needs review.",
    );
}

export function validateLandCoverTileUrl(value: unknown): string {
  const url = z.object({ url: z.string() }).parse(value).url;
  if (
    !/^https:\/\/earthengine\.googleapis\.com\/v1\/projects\/mapbiomas\/maps\/[A-Za-z0-9_-]+\/tiles\/\{z\}\/\{x\}\/\{y\}$/.test(
      url,
    )
  )
    throw Error(
      "The provider returned an unsupported land-cover tile address.",
    );
  return url;
}

/** Temporary provider tile URLs stay in memory only; request a fresh one on retry. */
export async function loadLandCover(
  signal?: AbortSignal,
): Promise<{ tileUrl: string }> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 25000);
  const read = async (path: string) => {
    const response = await fetch(API + path, {
      signal: controller.signal,
      credentials: "omit",
      cache: "no-store",
      headers: { "tenant-id": "mapbiomas" },
    });
    if (!response.ok)
      throw Error(
        "MapBiomas context is unavailable. Detection records are unchanged.",
      );
    return response.json();
  };
  try {
    const [definition, legend] = await Promise.all([
      read("themes/subthemes?subthemeKey=" + LAND_COVER_SUBTHEME),
      read("legends/by/key/" + LEGEND),
    ]);
    validateLandCoverDefinition(definition, legend);
    const params = new URLSearchParams({
      territoryId: "1-4-6",
      subthemeKey: LAND_COVER_SUBTHEME,
      legendKey: LEGEND,
      year: String(LAND_COVER_YEAR),
    });
    for (const item of landCoverClasses)
      params.append("pixelValue", String(item.value));
    return {
      tileUrl: validateLandCoverTileUrl(
        await read("maps/map?" + params.toString()),
      ),
    };
  } finally {
    controller.abort();
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
