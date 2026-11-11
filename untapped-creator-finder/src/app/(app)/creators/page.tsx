import Link from "next/link";
import { ArrowDown, ArrowUp, Download, Plus, Columns3, Users } from "lucide-react";
import { requireContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { listCreators, getFilterOptions } from "@/server/creators";
import { parseFilters, toQuery, hasActiveFilters, type SortKey, type CreatorFilters } from "@/server/filters";
import { Avatar, Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { ScorePill } from "@/components/score";
import { FilterBar } from "@/components/creators/filter-bar";
import { PlatformChips } from "@/components/creators/platform-icons";
import { SaveButton } from "@/components/creators/save-button";
import { fmtCount, fmtGrowth, fmtPct } from "@/lib/format";
import { STATUS_LABEL, STATUS_TONE, COUNTRY_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const metadata = { title: "Creators" };

function SortHeader({ f, k, children, className }: { f: CreatorFilters; k: SortKey; children: React.ReactNode; className?: string }) {
  const active = (f.sort ?? "discovered") === k;
  const defaultDir = k === "name" || k === "saturation" ? "asc" : "desc";
  const cur = f.dir ?? defaultDir;
  const next = active ? (cur === "asc" ? "desc" : "asc") : defaultDir;
  return (
    <th className={cn("px-3 py-2.5 font-medium", className)}>
      <Link
        href={toQuery(f, { sort: k, dir: next, page: undefined })}
        className={cn("inline-flex items-center gap-1 hover:text-ink", active && "text-ink")}
      >
        {children}
        {active && (cur === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </Link>
    </th>
  );
}

export default async function CreatorsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireContext();
  const f = parseFilters(await searchParams);
  const [{ total, rows, page, pageCount }, { niches }, lists] = await Promise.all([
    listCreators(f, ctx.workspaceId),
    getFilterOptions(),
    prisma.prospectList.findMany({ where: { workspaceId: ctx.workspaceId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const q = f;
  const advanced = Object.entries(f).some(
    ([k, v]) => v !== undefined && !["q", "niche", "platform", "size", "sort", "dir", "page"].includes(k),
  );

  return (
    <>
      <PageHeader
        title="Creators"
        description="Every creator in the database. Unknown values show as “—”, never as zero."
        actions={
          <>
            <ButtonLink href={`/api/export${toQuery(q, { page: undefined })}`} prefetch={false}>
              <Download className="size-4" /> Export CSV
            </ButtonLink>
            <ButtonLink href="/creators/new" variant="primary">
              <Plus className="size-4" /> Add creator
            </ButtonLink>
          </>
        }
      />

      <FilterBar f={f} niches={niches} lists={lists} advancedOpen={advanced} />

      <form id="compare-form" action="/compare" method="get" />

      <Card className="mt-4 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 text-[12.5px] text-muted">
          <span>
            <span className="tabular font-medium text-ink">{total.toLocaleString()}</span> creator{total === 1 ? "" : "s"}
            {hasActiveFilters(f) && " match your filters"}
          </span>
          <button form="compare-form" className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium text-ink-2 hover:bg-surface-2 hover:text-ink">
            <Columns3 className="size-3.5" /> Compare selected
          </button>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={<Users className="size-5" />} title={hasActiveFilters(f) ? "No creators match these filters" : "No creators yet"}>
            {hasActiveFilters(f) ? (
              <Link href="/creators" className="text-accent">Clear filters</Link>
            ) : (
              <>Add one manually, or load demo data from Settings.</>
            )}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-[13px]">
              <thead className="bg-surface-2/60 text-[12px] text-muted">
                <tr>
                  <th className="w-10 px-3 py-2.5"><span className="sr-only">Select</span></th>
                  <SortHeader f={f} k="name">Creator</SortHeader>
                  <th className="px-3 py-2.5 font-medium">Niche</th>
                  <SortHeader f={f} k="followers" className="text-right">Followers</SortHeader>
                  <SortHeader f={f} k="engagement" className="text-right">Engagement</SortHeader>
                  <SortHeader f={f} k="growth" className="text-right">30d growth</SortHeader>
                  <th className="px-3 py-2.5 text-right font-medium" title="Publicly observed commercial signals">Signals</th>
                  <SortHeader f={f} k="saturation">Saturation</SortHeader>
                  <SortHeader f={f} k="opportunity">Opportunity</SortHeader>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="w-10 px-3 py-2.5"><span className="sr-only">Save</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((c) => {
                  const p = c.prospects[0];
                  const handle = c.accounts[0]?.handle;
                  return (
                    <tr key={c.id} className="transition hover:bg-surface-2/50">
                      <td className="px-3 py-2.5">
                        <input form="compare-form" type="checkbox" name="ids" value={c.id} aria-label={`Select ${c.displayName}`} className="size-4 accent-[var(--accent)]" />
                      </td>
                      <td className="px-3 py-2.5">
                        <Link href={`/creators/${c.id}`} className="flex items-center gap-2.5">
                          <Avatar name={c.displayName} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-ink hover:underline">{c.displayName}</span>
                              {c.isDemo && <Badge tone="muted">Demo</Badge>}
                            </div>
                            <div className="flex items-center gap-1.5 text-[12px] text-muted">
                              {handle && <span>@{handle}</span>}
                              <PlatformChips platforms={c.platforms} />
                              {c.country && <span title={COUNTRY_NAME[c.country]}>{c.country}</span>}
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-ink-2">{c.primaryNiche ?? <span className="text-muted">—</span>}</td>
                      <td className="tabular px-3 py-2.5 text-right font-medium">{fmtCount(c.totalFollowers)}</td>
                      <td className="tabular px-3 py-2.5 text-right">{fmtPct(c.engagementRate)}</td>
                      <td
                        className={cn(
                          "tabular px-3 py-2.5 text-right",
                          c.followerGrowth30d != null && c.followerGrowth30d > 0.05 && "text-good",
                          c.followerGrowth30d != null && c.followerGrowth30d < 0 && "text-bad",
                        )}
                      >
                        {fmtGrowth(c.followerGrowth30d)}
                      </td>
                      <td className="tabular px-3 py-2.5 text-right">{c.commercialSignalCount}</td>
                      <td className="px-3 py-2.5"><ScorePill kind="saturation" value={c.saturationScore} confidence={c.scoreConfidence} /></td>
                      <td className="px-3 py-2.5"><ScorePill kind="opportunity" value={c.opportunityScore} confidence={c.scoreConfidence} /></td>
                      <td className="px-3 py-2.5">
                        {p ? <Badge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge> : <span className="text-[12px] text-muted">Untracked</span>}
                      </td>
                      <td className="px-3 py-2.5"><SaveButton creatorId={c.id} saved={!!p?.saved} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-[12.5px] text-muted">
            <span>Page {page} of {pageCount}</span>
            <div className="flex gap-2">
              {page > 1 && <ButtonLink size="sm" href={toQuery(q, { page: page - 1 })}>Previous</ButtonLink>}
              {page < pageCount && <ButtonLink size="sm" href={toQuery(q, { page: page + 1 })}>Next</ButtonLink>}
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
