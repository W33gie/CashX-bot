import { FlaskConical, KeyRound } from "lucide-react";
import { requireContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Badge, Button, Card, CardHeader, PageHeader } from "@/components/ui";
import { PROVIDERS, credentialsPresent } from "@/server/providers/registry";
import { loadDemoData, removeDemoData } from "../actions";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await requireContext();
  const [demoCount, total, members] = await Promise.all([
    prisma.creator.count({ where: { isDemo: true } }),
    prisma.creator.count(),
    prisma.membership.findMany({ where: { workspaceId: ctx.workspaceId }, include: { user: { select: { name: true, email: true } } } }),
  ]);

  return (
    <>
      <PageHeader title="Settings" description={ctx.workspaceName} />

      <Card className="mb-5">
        <CardHeader
          title="Data providers"
          description="What each source can legitimately give us, and whether it's connected. Nothing here is simulated — unbuilt integrations say so."
        />
        <div className="divide-y divide-line">
          {PROVIDERS.map((p) => {
            const creds = credentialsPresent(p);
            return (
              <div key={p.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[1.2fr_2fr_1fr]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-semibold">{p.name}</span>
                    <Badge tone={p.built ? "good" : "muted"}>{p.built ? "Built" : `Phase ${p.phase}`}</Badge>
                  </div>
                  <div className="mt-0.5 text-[12px] text-muted">{p.platforms.join(" · ")} · {p.cost}</div>
                </div>
                <div className="space-y-1 text-[12.5px] text-ink-2">
                  <p><span className="font-medium text-ink">Gives: </span>{p.gives}</p>
                  <p><span className="font-medium text-ink">Access: </span>{p.access}</p>
                  <p><span className="font-medium text-ink">Limits: </span>{p.limits}</p>
                </div>
                <div className="space-y-1">
                  {creds.map((c) => (
                    <div key={c.name} className="flex items-center gap-1.5 font-mono text-[11.5px]">
                      <KeyRound className={`size-3 ${c.set ? "text-good" : "text-muted"}`} />
                      <span className={c.set ? "text-ink" : "text-muted"}>{c.name}</span>
                      <span className={c.set ? "text-good" : "text-muted"}>{c.set ? "set" : "missing"}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Demo data" description="Fictional creators for exploring the product. Always labelled “Demo”." />
          <div className="px-5 py-4">
            <p className="text-[13px] text-ink-2">
              <span className="tabular font-semibold">{demoCount}</span> demo creators of {total} total.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={loadDemoData}>
                <Button><FlaskConical className="size-4" /> {demoCount ? "Reset demo data" : "Load demo data"}</Button>
              </form>
              {demoCount > 0 && (
                <form action={removeDemoData}>
                  <Button variant="danger">Remove all demo data</Button>
                </form>
              )}
            </div>
            <p className="mt-3 text-[12px] text-muted">Removing demo data also removes your notes, statuses and list entries for those demo creators.</p>
          </div>
        </Card>
        <Card>
          <CardHeader title="Workspace members" description="Team invites arrive with the partnership CRM module." />
          <ul className="divide-y divide-line">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between px-5 py-3 text-[13px]">
                <span>{m.user.name} <span className="text-muted">· {m.user.email}</span></span>
                <Badge>{m.role.toLowerCase()}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
