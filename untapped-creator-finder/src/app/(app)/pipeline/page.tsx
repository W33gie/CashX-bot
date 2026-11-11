import Link from "next/link";
import { requireContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Avatar, Badge, Card, PageHeader } from "@/components/ui";
import { ScorePill } from "@/components/score";
import { StatusSelect } from "@/components/creators/profile-forms";
import { PROSPECT_STATUSES } from "@/lib/constants";
import { fmtCount, fmtRelative } from "@/lib/format";
import { Bookmark } from "lucide-react";

export const metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const ctx = await requireContext();
  const prospects = await prisma.prospect.findMany({
    where: { workspaceId: ctx.workspaceId },
    include: { creator: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <>
      <PageHeader
        title="Outreach pipeline"
        description="Every creator your workspace is tracking, by stage. Change a stage from the dropdown — it's logged to the creator's activity."
      />
      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="grid min-w-max auto-cols-[272px] grid-flow-col gap-3">
          {PROSPECT_STATUSES.map((s) => {
            const items = prospects.filter((p) => p.status === s.value);
            return (
              <section key={s.value} className="flex flex-col rounded-xl bg-surface-2/70 p-2">
                <header className="flex items-center justify-between px-2 py-1.5">
                  <h2 className="text-[12.5px] font-semibold">{s.label}</h2>
                  <Badge tone={s.tone}>{items.length}</Badge>
                </header>
                <div className="mt-1 space-y-2">
                  {items.length === 0 && <p className="px-2 py-4 text-center text-[12px] text-muted">Empty</p>}
                  {items.map((p) => (
                    <Card key={p.id} className="p-3">
                      <Link href={`/creators/${p.creator.id}`} className="flex items-center gap-2">
                        <Avatar name={p.creator.displayName} className="size-7" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1 truncate text-[13px] font-medium hover:underline">
                            {p.creator.displayName}
                            {p.saved && <Bookmark className="size-3 shrink-0 text-accent" fill="currentColor" />}
                          </div>
                          <div className="text-[11.5px] text-muted">
                            {p.creator.primaryNiche ?? "—"} · {fmtCount(p.creator.totalFollowers)}
                            {p.creator.isDemo && " · demo"}
                          </div>
                        </div>
                      </Link>
                      <div className="mt-2 flex items-center justify-between">
                        <ScorePill kind="opportunity" value={p.creator.opportunityScore} confidence={p.creator.scoreConfidence} />
                        <span className="text-[11px] text-muted">{fmtRelative(p.updatedAt)}</span>
                      </div>
                      <div className="mt-2 [&_select]:h-8 [&_select]:w-full [&_select]:text-[12px]">
                        <StatusSelect creatorId={p.creator.id} status={p.status} />
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
