import type { Platform, ProspectStatus, SignalType, DataSource } from "@/generated/prisma/enums";

export const PLATFORMS: { value: Platform; label: string }[] = [
  { value: "YOUTUBE", label: "YouTube" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "TIKTOK", label: "TikTok" },
];
export const PLATFORM_LABEL: Record<Platform, string> = {
  YOUTUBE: "YouTube",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
};

/** Ordered pipeline. NOT_A_FIT is terminal and shown separately. */
export const PROSPECT_STATUSES: { value: ProspectStatus; label: string; tone: Tone }[] = [
  { value: "NEW", label: "New", tone: "neutral" },
  { value: "RESEARCHING", label: "Researching", tone: "info" },
  { value: "QUALIFIED", label: "Qualified", tone: "accent" },
  { value: "CONTACTED", label: "Contacted", tone: "warn" },
  { value: "IN_CONVERSATION", label: "In conversation", tone: "warn" },
  { value: "PARTNERED", label: "Partnered", tone: "good" },
  { value: "NOT_A_FIT", label: "Not a fit", tone: "muted" },
];
export const STATUS_LABEL = Object.fromEntries(PROSPECT_STATUSES.map((s) => [s.value, s.label])) as Record<
  ProspectStatus,
  string
>;
export const STATUS_TONE = Object.fromEntries(PROSPECT_STATUSES.map((s) => [s.value, s.tone])) as Record<
  ProspectStatus,
  Tone
>;

export type Tone = "neutral" | "info" | "accent" | "warn" | "good" | "bad" | "muted";

export const SIGNAL_LABEL: Record<SignalType, string> = {
  SPONSORSHIP: "Sponsorship",
  AFFILIATE: "Affiliate links",
  DIGITAL_PRODUCT: "Digital product",
  COURSE: "Course",
  MEMBERSHIP: "Membership",
  SERVICE: "Paid service",
  MERCH: "Merchandise",
  BRAND_PARTNERSHIP: "Brand partnership",
  BUSINESS_CONTACT: "Business contact listed",
  TALENT_MANAGEMENT: "Talent management",
};

export const SOURCE_LABEL: Record<DataSource, string> = {
  MANUAL: "Entered manually",
  DEMO: "Demo data (fictional)",
  YOUTUBE_API: "YouTube Data API",
  INSTAGRAM_GRAPH_API: "Instagram Graph API",
  TIKTOK_RESEARCH_API: "TikTok Research API",
  THIRD_PARTY_PROVIDER: "Third-party provider",
  CSV_IMPORT: "CSV import",
};

/** Starting taxonomy. Free-text niches are also allowed. */
export const NICHES = [
  "Fitness",
  "Personal finance",
  "Parenting",
  "Food & cooking",
  "Beauty",
  "Fashion",
  "Lifestyle",
  "Travel",
  "Tech",
  "Gaming",
  "Education",
  "Productivity",
  "Home & DIY",
  "Pets",
  "Wellness",
  "Business",
  "Music",
  "Art & design",
] as const;

/** Creator size tiers by total followers. Industry-standard boundaries. */
export const SIZE_TIERS = [
  { value: "nano", label: "Nano (1K–10K)", min: 1_000, max: 10_000 },
  { value: "micro", label: "Micro (10K–100K)", min: 10_000, max: 100_000 },
  { value: "mid", label: "Mid-tier (100K–500K)", min: 100_000, max: 500_000 },
  { value: "macro", label: "Macro (500K–1M)", min: 500_000, max: 1_000_000 },
  { value: "mega", label: "Mega (1M+)", min: 1_000_000, max: undefined },
] as const;
export type SizeTier = (typeof SIZE_TIERS)[number]["value"];

/** Thresholds used by dashboard tiles. Kept in one place so they're tunable. */
export const THRESHOLDS = {
  highOpportunity: 70,
  lowSaturation: 30,
  minConfidence: 0.5,
  recentDays: 7,
};

export const COUNTRIES: [string, string][] = [
  ["US", "United States"], ["GB", "United Kingdom"], ["CA", "Canada"], ["AU", "Australia"],
  ["IE", "Ireland"], ["NZ", "New Zealand"], ["DE", "Germany"], ["FR", "France"], ["ES", "Spain"],
  ["IT", "Italy"], ["NL", "Netherlands"], ["SE", "Sweden"], ["NO", "Norway"], ["DK", "Denmark"],
  ["PT", "Portugal"], ["PL", "Poland"], ["BR", "Brazil"], ["MX", "Mexico"], ["AR", "Argentina"],
  ["IN", "India"], ["PH", "Philippines"], ["ID", "Indonesia"], ["NG", "Nigeria"], ["ZA", "South Africa"],
  ["KE", "Kenya"], ["AE", "United Arab Emirates"], ["JP", "Japan"], ["KR", "South Korea"], ["SG", "Singapore"],
];
export const LANGUAGES: [string, string][] = [
  ["en", "English"], ["es", "Spanish"], ["pt", "Portuguese"], ["fr", "French"], ["de", "German"],
  ["it", "Italian"], ["nl", "Dutch"], ["sv", "Swedish"], ["pl", "Polish"], ["hi", "Hindi"],
  ["id", "Indonesian"], ["tl", "Tagalog"], ["ja", "Japanese"], ["ko", "Korean"], ["ar", "Arabic"],
];
export const COUNTRY_NAME = Object.fromEntries(COUNTRIES);
export const LANGUAGE_NAME = Object.fromEntries(LANGUAGES);
