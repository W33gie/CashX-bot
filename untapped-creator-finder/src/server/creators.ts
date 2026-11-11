import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { SIZE_TIERS, THRESHOLDS, PROSPECT_STATUSES } from "@/lib/constants";
import type { CreatorFilters, SortKey } from "./filters";

export const PAGE_SIZE = 25;

export function buildCreatorWhere(f: CreatorFilters, workspaceId: string): Prisma.CreatorWhereInput {
  const and: Prisma.CreatorWhereInput[] = [];

  if (f.q) {
    and.push({
      OR: [
        { displayName: { contains: f.q, mode: "insensitive" } },
        { bio: { contains: f.q, mode: "insensitive" } },
        { primaryNiche: { contains: f.q, mode: "insensitive" } },
        { accounts: { some: { handle: { contains: f.q.replace(/^@/, ""), mode: "insensitive" } } } },
      ],
    });
  }
  if (f.niche) and.push({ OR: [{ primaryNiche: f.niche }, { niches: { has: f.niche } }] });
  if (f.platform) and.push({ platforms: { has: f.platform as never } });
  if (f.country) and.push({ country: f.country });
  if (f.language) and.push({ language: f.language });

  if (f.size) {
    const t = SIZE_TIERS.find((s) => s.value === f.size)!;
    and.push({ totalFollowers: { gte: t.min, ...(t.max ? { lt: t.max } : {}) } });
  }
  if (f.minFollowers != null) and.push({ totalFollowers: { gte: f.minFollowers } });
  if (f.maxFollowers != null) and.push({ totalFollowers: { lte: f.maxFollowers } });
  if (f.minEngagement != null) and.push({ engagementRate: { gte: f.minEngagement / 100 } });
  if (f.minGrowth != null) and.push({ followerGrowth30d: { gte: f.minGrowth / 100 } });
  if (f.maxSaturation != null) and.push({ saturationScore: { lte: f.maxSaturation } });
  if (f.minOpportunity != null) and.push({ opportunityScore: { gte: f.minOpportunity } });

  if (f.commercial === "none_observed") and.push({ commercialSignalCount: 0 });
  if (f.commercial === "some") and.push({ commercialSignalCount: { gte: 1, lte: 4 } });
  if (f.commercial === "heavy") and.push({ commercialSignalCount: { gte: 5 } });

  if (f.status) and.push({ prospects: { some: { workspaceId, status: f.status as never } } });
  if (f.saved) and.push({ prospects: { some: { workspaceId, saved: true } } });
  if (f.list) and.push({ prospects: { some: { workspaceId, listItems: { some: { listId: f.list } } } } });

  if (f.demo === "hide") and.push({ isDemo: false });
  if (f.demo === "only") and.push({ isDemo: true });

  return and.length ? { AND: and } : {};
}

const SORT_FIELD: Record<SortKey, keyof Prisma.CreatorOrderByWithRelationInput> = {
  name: "displayName",
  followers: "totalFollowers",
  engagement: "engagementRate",
  growth: "followerGrowth30d",
  opportunity: "opportunityScore",
  saturation: "saturationScore",
  discovered: "discoveredAt",
};

export function buildOrderBy(f: CreatorFilters): Prisma.CreatorOrderByWithRelationInput[] {
  const key = f.sort ?? "discovered";
  const dir = f.dir ?? (key === "name" || key === "saturation" ? "asc" : "desc");
  const field = SORT_FIELD[key];
  const nullable = key !== "name" && key !== "discovered";
  return [
    { [field]: nullable ? { sort: dir, nulls: "last" } : dir } as Prisma.CreatorOrderByWithRelationInput,
    { id: "asc" },
  ];
}

const listInclude = (workspaceId: string) =>
  ({
    accounts: { select: { platform: true, handle: true, url: true, followers: true }, orderBy: { followers: "desc" } },
    prospects: { where: { workspaceId }, select: { id: true, status: true, saved: true } },
  }) satisfies Prisma.CreatorInclude;

export type CreatorRow = Prisma.CreatorGetPayload<{ include: ReturnType<typeof listInclude> }>;

export async function listCreators(f: CreatorFilters, workspaceId: string, opts: { all?: boolean } = {}) {
  const where = buildCreatorWhere(f, workspaceId);
  const page = Math.max(1, f.page ?? 1);
  const [total, rows] = await Promise.all([
    prisma.creator.count({ where }),
    prisma.creator.findMany({
      where,
      orderBy: buildOrderBy(f),
      include: listInclude(workspaceId),
      skip: opts.all ? 0 : (page - 1) * PAGE_SIZE,
      take: (opts.all ? 10_000 : PAGE_SIZE) as number,
    }),
  ]);
  return { total, rows, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getCreatorProfile(id: string, workspaceId: string) {
  return prisma.creator.findUnique({
    where: { id },
    include: {
      accounts: {
        orderBy: { followers: { sort: "desc", nulls: "last" } },
        include: { snapshots: { orderBy: { capturedAt: "asc" }, take: 120 } },
      },
      signals: { orderBy: { observedAt: "desc" } },
      scores: { orderBy: { computedAt: "desc" }, take: 10 },
      analyses: { orderBy: { createdAt: "desc" }, take: 1 },
      prospects: {
        where: { workspaceId },
        include: { listItems: { include: { list: { select: { id: true, name: true } } } } },
      },
    },
  });
}
export type CreatorProfile = NonNullable<Awaited<ReturnType<typeof getCreatorProfile>>>;

export async function getCreatorsForCompare(ids: string[], workspaceId: string) {
  return prisma.creator.findMany({
    where: { id: { in: ids.slice(0, 4) } },
    include: {
      accounts: { orderBy: { followers: { sort: "desc", nulls: "last" } } },
      signals: { select: { type: true, evidenceKind: true } },
      prospects: { where: { workspaceId }, select: { status: true, saved: true } },
    },
  });
}

export async function getDashboard(workspaceId: string) {
  const since = new Date(Date.now() - THRESHOLDS.recentDays * 86400_000);
  const confident = { scoreConfidence: { gte: THRESHOLDS.minConfidence } };

  const [
    total,
    demoCount,
    scored,
    highOpp,
    lowSat,
    recentCount,
    needsResearch,
    saved,
    pipelineRaw,
    nicheRaw,
    recent,
    topOpportunities,
  ] = await Promise.all([
    prisma.creator.count(),
    prisma.creator.count({ where: { isDemo: true } }),
    prisma.creator.count({ where: { opportunityScore: { not: null } } }),
    prisma.creator.count({ where: { opportunityScore: { gte: THRESHOLDS.highOpportunity }, ...confident } }),
    prisma.creator.count({ where: { saturationScore: { lte: THRESHOLDS.lowSaturation }, ...confident } }),
    prisma.creator.count({ where: { discoveredAt: { gte: since } } }),
    // Needs research: never scored, scored with low confidence, or flagged by the team.
    prisma.creator.count({
      where: {
        OR: [
          { scoredAt: null },
          { scoreConfidence: { lt: THRESHOLDS.minConfidence } },
          { prospects: { some: { workspaceId, status: "RESEARCHING" } } },
        ],
      },
    }),
    prisma.prospect.count({ where: { workspaceId, saved: true } }),
    prisma.prospect.groupBy({ by: ["status"], where: { workspaceId }, _count: { _all: true } }),
    prisma.creator.groupBy({
      by: ["primaryNiche"],
      _count: { _all: true },
      _avg: { opportunityScore: true, saturationScore: true },
      orderBy: { _count: { primaryNiche: "desc" } },
      take: 10,
    }),
    prisma.creator.findMany({ orderBy: { discoveredAt: "desc" }, take: 6, include: listInclude(workspaceId) }),
    prisma.creator.findMany({
      where: { opportunityScore: { not: null }, ...confident },
      orderBy: [{ opportunityScore: "desc" }, { id: "asc" }],
      take: 6,
      include: listInclude(workspaceId),
    }),
  ]);

  const pipeline = PROSPECT_STATUSES.map((s) => ({
    status: s.value,
    label: s.label,
    tone: s.tone,
    count: pipelineRaw.find((p) => p.status === s.value)?._count._all ?? 0,
  }));

  const niches = nicheRaw.map((n) => ({
    niche: n.primaryNiche ?? "Unclassified",
    count: n._count._all,
    avgOpportunity: n._avg.opportunityScore == null ? null : Math.round(n._avg.opportunityScore),
    avgSaturation: n._avg.saturationScore == null ? null : Math.round(n._avg.saturationScore),
  }));

  return {
    total,
    demoCount,
    scored,
    highOpp,
    lowSat,
    recentCount,
    needsResearch,
    saved,
    pipeline,
    niches,
    recent,
    topOpportunities,
  };
}

export async function getFilterOptions() {
  const niches = await prisma.creator.findMany({
    where: { primaryNiche: { not: null } },
    distinct: ["primaryNiche"],
    select: { primaryNiche: true },
    orderBy: { primaryNiche: "asc" },
  });
  return { niches: niches.map((n) => n.primaryNiche!) };
}
