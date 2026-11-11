import Link from "next/link";
import { Sparkles, Users, Target, Feather, Clock, Search, Bookmark, ArrowRight, FlaskConical } from "lucide-react";
import { requireContext } from "@/lib/session";
import { getDashboard } from "@/server/creators";
import { Card, CardHeader, PageHeader, ButtonLink, EmptyState } from "@/components/ui";
import { NicheChart } from "@/components/charts/niche-chart";
import { CreatorMiniList } from "@/components/creators/creator-mini-list";
import { THRESHOLDS } from "@/lib/constants";
import { loadDemoData } from "./actions";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

function Kpi({
  label,
  value,
  hint,
  href,
  icon: Icon,
  pending,
}: {
  label: string;
  value: number | string;
  hint: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  pending?: boolean;
}) {
  return (
    <Link href={href} className="group">
      <Card className="h-full p-4 transition group-hover:border-line-strong">
        <div className="flex items-center justify-between text-muted">
          <span className="text-[12px] font-medium">{label}</span>
          <Icon className="size-4" />
        </div>
        <div className={cn("tabular mt-2 text-[26px] font-semibold tracking-tight", pending && "text-muted")}>{value}</div>
        <div className="mt-0.5 text-[11.5px] text-muted">{hint}</div>
      </Card>
    </Link>
  );
}

export default async function DashboardPage() {
  const ctx = await requireContext();
  const d = await getDashboard(ctx.workspaceId);
  const scoringLive = d.scored > 0;
  const pipelineTotal = d.pipeline.reduce((s, p) => s + p.count, 0);

  if (d.total === 0) {
    return (
      <>
        <PageHeader title={`Welcome, ${ctx.user.name.split(" ")[0]}`} description="Your creator intelligence workspace is ready." />
        <Card>
          <EmptyState
            icon={<Sparkles className="size-5" />}
            title="No creators yet"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <ButtonLink href="/creators/new" variant="primary">Add a creator</ButtonLink>
                <form action={loadDemoData}>
                  <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[13px] font-medium hover:bg-surface-2">
                    <FlaskConical className="size-4" /> Load fictional demo data
                  </button>
                </form>
              </div>
            }
          >
            Add creators you already know about, or load a clearly-labelled fictional dataset to explore the product.
            Automated discovery from YouTube arrives in Phase 2.
          </EmptyState>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={ctx.workspaceName}
        title="Dashboard"
        description="Where the overlooked opportunities are right now."
        actions={
          <>
            <ButtonLink href="/creators/new">Add creator</ButtonLink>
            <ButtonLink href="/creators" variant="primary">
              Explore creators <ArrowRight className="size-4" />
            </ButtonLink>
          </>
        }
      />

      {d.demoCount > 0 && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warn/30 bg-warn-soft px-4 py-2.5 text-[12.5px] text-warn">
          <span>
            <strong>{d.demoCount}</strong> of {d.total} creators are fictional demo data. They are labelled “Demo” everywhere.
          </span>
          <Link href="/settings" className="font-medium underline underline-offset-2">Manage demo data</Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Creators discovered" value={d.total} hint={`${d.recentCount} in last ${THRESHOLDS.recentDays} days`} href="/creators" icon={Users} />
        <Kpi
          label="High opportunity"
          value={scoringLive ? d.highOpp : "—"}
          hint={scoringLive ? `Score ≥ ${THRESHOLDS.highOpportunity}, confident` : "Scoring engine: Phase 3"}
          href={`/creators?minOpportunity=${THRESHOLDS.highOpportunity}&sort=opportunity`}
          icon={Target}
          pending={!scoringLive}
        />
        <Kpi
          label="Low saturation"
          value={scoringLive ? d.lowSat : "—"}
          hint={scoringLive ? `Saturation ≤ ${THRESHOLDS.lowSaturation}, confident` : "Scoring engine: Phase 3"}
          href={`/creators?maxSaturation=${THRESHOLDS.lowSaturation}&sort=saturation`}
          icon={Feather}
          pending={!scoringLive}
        />
        <Kpi label="Recently discovered" value={d.recentCount} hint={`Last ${THRESHOLDS.recentDays} days`} href="/creators?sort=discovered" icon={Clock} />
        <Kpi label="Needs research" value={d.needsResearch} hint="Unscored, low confidence or flagged" href="/creators?status=RESEARCHING" icon={Search} />
        <Kpi label="Saved prospects" value={d.saved} hint="Bookmarked by your team" href="/creators?saved=1" icon={Bookmark} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader
            title="Creators by niche"
            description={scoringLive ? "Hover for average opportunity score" : "Opportunity averages appear once creators are scored"}
          />
          <div className="px-3 py-4">
            <NicheChart data={d.niches} />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Outreach pipeline"
            description={`${pipelineTotal} creators tracked by your workspace`}
            action={<Link href="/pipeline" className="text-[12.5px] font-medium text-accent">Open board</Link>}
          />
          <div className="space-y-2.5 px-5 py-4">
            {d.pipeline.map((p) => (
              <Link key={p.status} href={`/creators?status=${p.status}`} className="group grid grid-cols-[120px_1fr_36px] items-center gap-3">
                <span className="text-[12.5px] text-ink-2 group-hover:text-ink">{p.label}</span>
                <span className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <span
                    className="block h-full rounded-full bg-accent"
                    style={{ width: pipelineTotal ? `${(p.count / pipelineTotal) * 100}%` : 0, opacity: p.status === "NOT_A_FIT" ? 0.35 : 1 }}
                  />
                </span>
                <span className="tabular text-right text-[12.5px] font-medium">{p.count}</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Top opportunities" description="Highest opportunity score with adequate confidence" />
          {d.topOpportunities.length ? (
            <CreatorMiniList rows={d.topOpportunities} show="opportunity" />
          ) : (
            <EmptyState icon={<Target className="size-5" />} title="No scores yet">
              Saturation and opportunity scores are produced by the scoring engine (Phase 3). Until then we show
              “Not scored” rather than invent a number.
            </EmptyState>
          )}
        </Card>
        <Card>
          <CardHeader
            title="Recently discovered"
            action={<Link href="/creators?sort=discovered" className="text-[12.5px] font-medium text-accent">View all</Link>}
          />
          <CreatorMiniList rows={d.recent} show="discovered" />
        </Card>
      </div>
    </>
  );
}
