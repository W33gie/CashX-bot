// Pure metric calculations. No I/O, so they're unit-testable and reusable by agents.

/**
 * Pure: aggregate per-account metrics into creator-level rollups.
 * Unknown stays unknown: if no account reports a metric, the result is null.
 */
export function computeRollup(
  accounts: { platform: string; followers: number | null; engagementRate: number | null; lastPostAt: Date | null }[],
) {
  const known = accounts.filter((a) => a.followers != null);
  const totalFollowers = known.length ? known.reduce((s, a) => s + a.followers!, 0) : null;

  // Follower-weighted engagement, using only accounts that report both numbers.
  const eng = accounts.filter((a) => a.followers != null && a.followers > 0 && a.engagementRate != null);
  const weight = eng.reduce((s, a) => s + a.followers!, 0);
  const engagementRate = weight > 0 ? eng.reduce((s, a) => s + a.engagementRate! * a.followers!, 0) / weight : null;

  const lastPostAt = accounts.reduce<Date | null>(
    (m, a) => (a.lastPostAt && (!m || a.lastPostAt > m) ? a.lastPostAt : m),
    null,
  );
  const platforms = [...new Set(accounts.map((a) => a.platform))];
  return { totalFollowers, engagementRate, lastPostAt, platforms };
}

/**
 * Pure: follower growth over ~30 days from snapshot history.
 * Needs a snapshot at least 21 days older than the newest one, else null.
 */
export function computeGrowth30d(snapshots: { capturedAt: Date; followers: number | null }[]): number | null {
  const s = snapshots.filter((x) => x.followers != null).sort((a, b) => +a.capturedAt - +b.capturedAt);
  if (s.length < 2) return null;
  const latest = s[s.length - 1]!;
  const target = +latest.capturedAt - 30 * 86400_000;
  // closest snapshot to 30 days before the latest, but at least 21 days older
  const candidates = s.filter((x) => +latest.capturedAt - +x.capturedAt >= 21 * 86400_000);
  if (!candidates.length) return null;
  const base = candidates.reduce((best, x) =>
    Math.abs(+x.capturedAt - target) < Math.abs(+best.capturedAt - target) ? x : best,
  );
  if (!base.followers) return null;
  return (latest.followers! - base.followers) / base.followers;
}
