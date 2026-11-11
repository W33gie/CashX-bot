import Link from "next/link";
import { Columns3 } from "lucide-react";
import { requireContext } from "@/lib/session";
import { getCreatorsForCompare } from "@/server/creators";
import { Avatar, Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { ScorePill } from "@/components/score";
import { PlatformChips } from "@/components/creators/platform-icons";
import { fmtCount, fmtGrowth, fmtPct, fmtRelative } from "@/lib/format";
import { COUNTRY_NAME, SIGNAL_LABEL, STATUS_LABEL } from "@/lib/constants";
import type { SignalType } from "@/generated/prisma/enums";

export const metadata = { title: "Compare" };

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string | string[] }> }) {
  const ctx = await requireContext();
  const raw = (await searchParams).ids;
  const ids = (Array.isArray(raw) ? raw : raw ? raw.split(",") : []).filter(Boolean);
  const found = ids.length ? await getCreatorsForCompare(ids, ctx.workspaceId) : [];
  const creators = ids.map((id) => found.find((c) => c.id === id)).filter((c) => !!c);

  if (creators.length === 0) {
    return (
      <>
        <PageHeader title="Compare creators" />
        <Card>
          <EmptyState icon={<Columns3 className="size-5" />} title="Pick creators to compare" action={<ButtonLink href="/creators" variant="primary">Go to creators</ButtonLink>}>
            Tick up to four creators in the Creators table and choose “Compare selected”.
          </EmptyState>
        </Card>
      </>
    );
  }

  // Highlight the best value in each numeric row.
  const best = (vals: (number | null)[], dir: "max" | "min") => {
    const known = vals.filter((v): v is number => v != null);
    if (known.length < 2) return null;
    return dir === "max" ? Math.max(...known) : Math.min(...known);
  };

  type Row = { label: string; render: (c: (typeof creators)[number]) => React.ReactNode; value?: (c: (typeof creators)[number]) => number | null; dir?: "max" | "min" };
  const rows: Row[] = [
    { label: "Niche", render: (c) => c.primaryNiche ?? "—" },
    { label: "Country", render: (c) => (c.country ? COUNTRY_NAME[c.country] ?? c.country : "—") },
    { label: "Platforms", render: (c) => <PlatformChips platforms={c.platforms} /> },
    { label: "Total followers", render: (c) => fmtCount(c.totalFollowers), value: (c) => c.totalFollowers, dir: "max" },
    { label: "Engagement rate", render: (c) => fmtPct(c.engagementRate), value: (c) => c.engagementRate, dir: "max" },
    { label: "30-day growth", render: (c) => fmtGrowth(c.followerGrowth30d), value: (c) => c.followerGrowth30d, dir: "max" },
    { label: "Last post", render: (c) => fmtRelative(c.lastPostAt) },
    { label: "Observed commercial signals", render: (c) => c.commercialSignalCount, value: (c) => c.commercialSignalCount, dir: "min" },
    {
      label: "Signal types",
      render: (c) => {
        const types = [...new Set(c.signals.map((s) => s.type))] as SignalType[];
        return types.length ? (
          <div className="flex flex-wrap gap-1">{types.map((t) => <Badge key={t}>{SIGNAL_LABEL[t]}</Badge>)}</div>
        ) : (
          <span className="text-muted">None observed</span>
        );
      },
    },
    { label: "Saturation", render: (c) => <ScorePill kind="saturation" value={c.saturationScore} confidence={c.scoreConfidence} />, value: (c) => c.saturationScore, dir: "min" },
    { label: "Opportunity", render: (c) => <ScorePill kind="opportunity" value={c.opportunityScore} confidence={c.scoreConfidence} />, value: (c) => c.opportunityScore, dir: "max" },
    { label: "Your status", render: (c) => (c.prospects[0] ? STATUS_LABEL[c.prospects[0].status] : "Untracked") },
  ];

  return (
    <>
      <PageHeader title="Compare creators" description="Best value per row is highlighted where at least two creators have data." />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead>
            <tr className="border-b border-line">
              <th className="w-48 px-4 py-3" />
              {creators.map((c) => (
                <th key={c.id} className="px-4 py-3 text-left align-top font-normal">
                  <Link href={`/creators/${c.id}`} className="flex items-center gap-2.5">
                    <Avatar name={c.displayName} />
                    <span>
                      <span className="block font-semibold hover:underline">{c.displayName}</span>
                      {c.isDemo && <Badge tone="muted">Demo</Badge>}
                    </span>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => {
              const b = r.value ? best(creators.map(r.value), r.dir!) : null;
              return (
                <tr key={r.label}>
                  <td className="px-4 py-2.5 text-[12.5px] font-medium text-muted">{r.label}</td>
                  {creators.map((c) => (
                    <td key={c.id} className={`tabular px-4 py-2.5 ${b != null && r.value!(c) === b ? "font-semibold text-accent" : ""}`}>
                      {r.render(c)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}
