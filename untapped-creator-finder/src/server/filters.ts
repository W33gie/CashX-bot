import { z } from "zod";
import { PLATFORMS, PROSPECT_STATUSES, SIZE_TIERS } from "@/lib/constants";

const optStr = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));
const optInt = z
  .string()
  .optional()
  .transform((v) => (v && /^\d+$/.test(v) ? Number(v) : undefined));
const optNum = z
  .string()
  .optional()
  .transform((v) => (v && !Number.isNaN(Number(v)) && v.trim() !== "" ? Number(v) : undefined));

export const SORT_KEYS = [
  "name",
  "followers",
  "engagement",
  "growth",
  "opportunity",
  "saturation",
  "discovered",
] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const creatorFilterSchema = z.object({
  q: optStr,
  niche: optStr,
  platform: z.enum(PLATFORMS.map((p) => p.value) as [string, ...string[]]).optional().catch(undefined),
  country: optStr,
  language: optStr,
  size: z.enum(SIZE_TIERS.map((s) => s.value) as [string, ...string[]]).optional().catch(undefined),
  minFollowers: optInt,
  maxFollowers: optInt,
  minEngagement: optNum, // percent, e.g. "3" = 3%
  minGrowth: optNum, // percent
  maxSaturation: optInt,
  minOpportunity: optInt,
  commercial: z.enum(["none_observed", "some", "heavy"]).optional().catch(undefined),
  status: z
    .enum(PROSPECT_STATUSES.map((s) => s.value) as [string, ...string[]])
    .optional()
    .catch(undefined),
  saved: z.enum(["1"]).optional().catch(undefined),
  list: optStr,
  demo: z.enum(["hide", "only"]).optional().catch(undefined),
  sort: z.enum(SORT_KEYS).optional().catch(undefined),
  dir: z.enum(["asc", "desc"]).optional().catch(undefined),
  page: optInt,
});
export type CreatorFilters = z.infer<typeof creatorFilterSchema>;

type RawParams = Record<string, string | string[] | undefined>;

export function parseFilters(params: RawParams | URLSearchParams): CreatorFilters {
  const obj: Record<string, string> = {};
  if (params instanceof URLSearchParams) {
    params.forEach((v, k) => (obj[k] = v));
  } else {
    for (const [k, v] of Object.entries(params)) if (typeof v === "string") obj[k] = v;
  }
  return creatorFilterSchema.parse(obj);
}

/** Build a querystring from filters, applying overrides. Drops empty values. */
export function toQuery(f: object, overrides: Record<string, string | number | undefined> = {}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...overrides })) {
    if (v !== undefined && v !== "" && v !== null) sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function hasActiveFilters(f: CreatorFilters) {
  const { sort, dir, page, ...rest } = f;
  void sort; void dir; void page;
  return Object.values(rest).some((v) => v !== undefined);
}
