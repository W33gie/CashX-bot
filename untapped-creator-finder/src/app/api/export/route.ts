import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseFilters } from "@/server/filters";
import { listCreators } from "@/server/creators";
import { toCsv } from "@/server/csv";
import { STATUS_LABEL } from "@/lib/constants";

/**
 * Export the current filtered view. Includes only data we are entitled to
 * redistribute internally: public profile metrics we collected, our scores and
 * the workspace's own CRM fields. No raw post content.
 */
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });
  const m = await prisma.membership.findFirst({ where: { userId: session.user.id }, orderBy: { createdAt: "asc" } });
  if (!m) return new Response("No workspace", { status: 403 });

  const f = parseFilters(new URL(req.url).searchParams);
  const { rows } = await listCreators(f, m.workspaceId, { all: true });

  const csv = toCsv(
    [
      "id", "name", "demo", "niche", "country", "language", "platforms", "primary_handle", "primary_url",
      "total_followers", "engagement_rate", "growth_30d", "observed_commercial_signals",
      "saturation_score", "opportunity_score", "score_confidence", "status", "saved", "discovered_at",
    ],
    rows.map((c) => {
      const p = c.prospects[0];
      return [
        c.id, c.displayName, c.isDemo ? "yes" : "no", c.primaryNiche, c.country, c.language, c.platforms.join("|"),
        c.accounts[0]?.handle, c.accounts[0]?.url, c.totalFollowers, c.engagementRate?.toFixed(4),
        c.followerGrowth30d?.toFixed(4), c.commercialSignalCount, c.saturationScore, c.opportunityScore,
        c.scoreConfidence?.toFixed(2), p ? STATUS_LABEL[p.status] : "", p?.saved ? "yes" : "no", c.discoveredAt,
      ];
    }),
  );

  await prisma.activityEvent.create({
    data: { workspaceId: m.workspaceId, actorType: "USER", actorId: session.user.id, type: "export.csv", payload: { rows: rows.length } },
  });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="creators-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
