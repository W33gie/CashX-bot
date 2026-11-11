/**
 * Data completeness: which inputs the scoring engine needs, and whether we
 * have them. This feeds score confidence in Phase 3 and tells researchers
 * exactly what to go and find.
 */
export type CompletenessInput = {
  bio: string | null;
  primaryNiche: string | null;
  accounts: {
    followers: number | null;
    engagementRate: number | null;
    postsLast30d: number | null;
    lastPostAt: Date | null;
    snapshots: { capturedAt: Date; followers: number | null }[];
  }[];
  contentCount: number;
};

export type CompletenessCheck = { key: string; label: string; ok: boolean; weight: number; why: string };

export function dataCompleteness(c: CompletenessInput) {
  const hasFollowers = c.accounts.some((a) => a.followers != null);
  const hasEngagement = c.accounts.some((a) => a.engagementRate != null);
  const hasCadence = c.accounts.some((a) => a.postsLast30d != null || a.lastPostAt != null);
  const hasHistory = c.accounts.some((a) => {
    const s = a.snapshots.filter((x) => x.followers != null).map((x) => +x.capturedAt);
    return s.length >= 2 && Math.max(...s) - Math.min(...s) >= 21 * 86400_000;
  });
  const checks: CompletenessCheck[] = [
    { key: "followers", label: "Audience size", ok: hasFollowers, weight: 0.15, why: "Needed to judge commercial activity relative to audience." },
    { key: "engagement", label: "Engagement rate", ok: hasEngagement, weight: 0.2, why: "Strongest public proxy for audience quality." },
    { key: "history", label: "Follower history (21+ days)", ok: hasHistory, weight: 0.15, why: "Growth is measured from snapshots, never guessed." },
    { key: "cadence", label: "Posting activity", ok: hasCadence, weight: 0.1, why: "Inactive creators are poor prospects." },
    { key: "content", label: "Recent content (5+ posts)", ok: c.contentCount >= 5, weight: 0.3, why: "Sponsorship and promotion signals are detected in post text." },
    { key: "bio", label: "Profile bio", ok: !!c.bio, weight: 0.05, why: "Bios reveal business contacts, management and products." },
    { key: "niche", label: "Niche classified", ok: !!c.primaryNiche, weight: 0.05, why: "Opportunity ideas depend on the niche." },
  ];
  const score = checks.reduce((s, x) => s + (x.ok ? x.weight : 0), 0);
  return { score: Math.round(score * 100) / 100, checks };
}
