import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Columns3 } from "lucide-react";
import { requireContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Avatar, Badge, ButtonLink, Card, EmptyState, PageHeader, Button } from "@/components/ui";
import { ScorePill } from "@/components/score";
import { fmtCount, fmtPct } from "@/lib/format";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/constants";
import { deleteList, removeFromList } from "../../actions";

export default async function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  const { id } = await params;
  const list = await prisma.prospectList.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: { items: { include: { prospect: { include: { creator: true } } }, orderBy: { addedAt: "desc" } } },
  });
  if (!list) notFound();
  const ids = list.items.map((i) => i.prospect.creator.id);

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/lists" className="hover:text-ink">← Lists</Link>}
        title={list.name}
        description={list.description ?? `${list.items.length} creators`}
        actions={
          <>
            {ids.length > 1 && <ButtonLink href={`/compare?ids=${ids.slice(0, 4).join(",")}`}><Columns3 className="size-4" /> Compare first 4</ButtonLink>}
            <ButtonLink href={`/api/export?list=${list.id}`} prefetch={false}><Download className="size-4" /> Export</ButtonLink>
            <form action={deleteList}>
              <input type="hidden" name="listId" value={list.id} />
              <Button variant="danger">Delete list</Button>
            </form>
          </>
        }
      />
      <Card className="overflow-hidden">
        {list.items.length === 0 ? (
          <EmptyState title="This list is empty">Add creators from their profile page.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {list.items.map(({ prospect: p }) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <Link href={`/creators/${p.creator.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={p.creator.displayName} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[13px] font-medium">
                      {p.creator.displayName}
                      {p.creator.isDemo && <Badge tone="muted">Demo</Badge>}
                    </div>
                    <div className="text-[12px] text-muted">
                      {p.creator.primaryNiche ?? "—"} · {fmtCount(p.creator.totalFollowers)} followers · {fmtPct(p.creator.engagementRate)} eng.
                    </div>
                  </div>
                </Link>
                <ScorePill kind="opportunity" value={p.creator.opportunityScore} confidence={p.creator.scoreConfidence} />
                <Badge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                <form action={removeFromList}>
                  <input type="hidden" name="creatorId" value={p.creator.id} />
                  <input type="hidden" name="listId" value={list.id} />
                  <button className="text-[12px] text-muted hover:text-bad">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
