import Link from "next/link";
import { ListChecks } from "lucide-react";
import { requireContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { CreateListForm } from "@/components/creators/list-forms";
import { fmtRelative } from "@/lib/format";

export const metadata = { title: "Lists" };

export default async function ListsPage() {
  const ctx = await requireContext();
  const lists = await prisma.prospectList.findMany({
    where: { workspaceId: ctx.workspaceId },
    include: { _count: { select: { items: true } } },
    orderBy: { createdAt: "desc" },
  });
  return (
    <>
      <PageHeader title="Prospect lists" description="Group creators into shortlists for campaigns, niches or teammates." />
      <Card className="mb-5">
        <CardHeader title="New list" />
        <div className="px-5 py-4"><CreateListForm /></div>
      </Card>
      {lists.length === 0 ? (
        <Card><EmptyState icon={<ListChecks className="size-5" />} title="No lists yet">Create one above, or from any creator&apos;s profile.</EmptyState></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((l) => (
            <Link key={l.id} href={`/lists/${l.id}`}>
              <Card className="h-full p-4 transition hover:border-line-strong">
                <div className="text-[14px] font-semibold">{l.name}</div>
                {l.description && <p className="mt-0.5 line-clamp-2 text-[12.5px] text-muted">{l.description}</p>}
                <div className="mt-3 text-[12px] text-muted">
                  <span className="tabular font-medium text-ink">{l._count.items}</span> creators · created {fmtRelative(l.createdAt)}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
