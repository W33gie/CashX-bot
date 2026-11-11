import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

import { computeRollup, computeGrowth30d } from "./metrics";

export { computeRollup, computeGrowth30d };

type Tx = Prisma.TransactionClient | typeof prisma;

/** Recompute denormalised fields on Creator. Call after any metrics/signal/score change. */
export async function refreshRollup(creatorId: string, tx: Tx = prisma) {
  const [accounts, signalCount, latestScores] = await Promise.all([
    tx.platformAccount.findMany({
      where: { creatorId },
      include: { snapshots: { orderBy: { capturedAt: "desc" }, take: 60 } },
    }),
    tx.commercialSignal.count({ where: { creatorId } }),
    Promise.all(
      (["SATURATION", "OPPORTUNITY"] as const).map((kind) =>
        tx.creatorScore.findFirst({ where: { creatorId, kind }, orderBy: { computedAt: "desc" } }),
      ),
    ),
  ]);

  const roll = computeRollup(accounts);

  // Growth: combine each account's growth weighted by its current followers.
  const growths = accounts
    .map((a) => ({ g: computeGrowth30d(a.snapshots), w: a.followers ?? 0 }))
    .filter((x) => x.g != null && x.w > 0);
  const gw = growths.reduce((s, x) => s + x.w, 0);
  const followerGrowth30d = gw > 0 ? growths.reduce((s, x) => s + x.g! * x.w, 0) / gw : null;

  const [sat, opp] = latestScores;
  await tx.creator.update({
    where: { id: creatorId },
    data: {
      platforms: roll.platforms as never,
      totalFollowers: roll.totalFollowers,
      engagementRate: roll.engagementRate,
      lastPostAt: roll.lastPostAt,
      followerGrowth30d,
      commercialSignalCount: signalCount,
      saturationScore: sat?.value ?? null,
      opportunityScore: opp?.value ?? null,
      scoreConfidence: opp?.confidence ?? sat?.confidence ?? null,
      scoredAt: opp?.computedAt ?? sat?.computedAt ?? null,
    },
  });
}
