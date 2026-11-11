/**
 * Data-provider registry. Describes each source honestly: what it can give
 * us, what it needs, and whether it's wired up. Phase 2 adds the adapters
 * (one module per provider implementing a common interface).
 */
export type ProviderStatus = "not_built" | "needs_credentials" | "ready";

export type ProviderInfo = {
  id: string;
  name: string;
  platforms: string[];
  envVars: string[];
  phase: number;
  built: boolean;
  cost: string;
  access: string;
  gives: string;
  limits: string;
};

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "youtube",
    name: "YouTube Data API v3",
    platforms: ["YouTube"],
    envVars: ["YOUTUBE_API_KEY"],
    phase: 2,
    built: false,
    cost: "Free (10,000 quota units/day)",
    access: "Self-serve API key from Google Cloud",
    gives: "Channel search, subscriber counts, video titles/descriptions, views, likes, comments",
    limits: "Search costs 100 units/call (~100 searches/day). Subscriber counts are rounded. No audience demographics.",
  },
  {
    id: "instagram",
    name: "Instagram Graph API — Business Discovery",
    platforms: ["Instagram"],
    envVars: ["INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_BUSINESS_ACCOUNT_ID"],
    phase: 2,
    built: false,
    cost: "Free",
    access: "Meta developer app + your own Instagram Business account; app review for production",
    gives: "Followers, media count, recent posts with captions and like/comment counts — for Business/Creator accounts you look up by username",
    limits: "No keyword search or discovery: you must already know the username. Personal accounts are not visible. Rate-limited per token.",
  },
  {
    id: "tiktok",
    name: "TikTok (Research API / partner programmes)",
    platforms: ["TikTok"],
    envVars: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
    phase: 2,
    built: false,
    cost: "Free, but gated",
    access: "Research API is approval-only and restricted to qualifying (largely non-commercial) research use. Commercial access usually goes through TikTok's marketing partner programmes or a licensed data provider.",
    gives: "Public profile stats and video metadata, if approved",
    limits: "Likely unavailable to us directly at MVP stage — plan on a licensed third-party provider for TikTok.",
  },
  {
    id: "third_party",
    name: "Licensed creator-data provider",
    platforms: ["Instagram", "TikTok", "YouTube"],
    envVars: ["CREATOR_DATA_PROVIDER_API_KEY"],
    phase: 2,
    built: false,
    cost: "Typically paid monthly or per-lookup; varies widely",
    access: "Commercial contract",
    gives: "Cross-platform search by niche/size/location, audience estimates, historical growth",
    limits: "Cost. Check each vendor's terms on storage, redistribution and how they source data.",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude API (AI analysis)",
    platforms: ["All"],
    envVars: ["ANTHROPIC_API_KEY"],
    phase: 4,
    built: false,
    cost: "Pay-per-token; a few cents per creator analysis with a small model",
    access: "Self-serve API key",
    gives: "Opportunity analysis, niche classification, signal detection on ambiguous text",
    limits: "Outputs are inferences and are always labelled as such.",
  },
];

export function providerStatus(p: ProviderInfo, env: NodeJS.ProcessEnv = process.env): ProviderStatus {
  if (!p.built) return "not_built";
  return p.envVars.every((v) => !!env[v]) ? "ready" : "needs_credentials";
}

export function credentialsPresent(p: ProviderInfo, env: NodeJS.ProcessEnv = process.env) {
  return p.envVars.map((v) => ({ name: v, set: !!env[v] }));
}
