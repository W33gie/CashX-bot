import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Columns3, Eye, Lightbulb, ShieldQuestion, CheckCircle2, Circle, Trash2, X } from "lucide-react";
import { requireContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getCreatorProfile } from "@/server/creators";
import { dataCompleteness } from "@/server/completeness";
import { Avatar, Badge, ButtonLink, Card, CardHeader, EmptyState } from "@/components/ui";
import { ScorePill, ConfidenceMeter } from "@/components/score";
import { SaveButton } from "@/components/creators/save-button";
import { GrowthChart } from "@/components/charts/growth-chart";
import {
  StatusSelect,
  NoteForm,
  SignalForm,
  MetricsForm,
  AddAccountForm,
  NewListInline,
} from "@/components/creators/profile-forms";
import { addToList, removeFromList, deleteNote, deleteCommercialSignal } from "../../actions";
import { fmtCount, fmtDate, fmtGrowth, fmtPct, fmtRelative } from "@/lib/format";
import { COUNTRY_NAME, LANGUAGE_NAME, PLATFORM_LABEL, SIGNAL_LABEL, SOURCE_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Breakdown = { factor: string; value?: string | number | null; weight?: number; contribution?: number; evidenceKind?: string; note?: string }[];

function Stat({ label, value, sub, className }: { label: string; value: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("px-4 py-3", className)}>
      <div className="text-[11.5px] font-medium text-muted">{label}</div>
      <div className="tabular mt-0.5 text-[18px] font-semibold tracking-tight">{value}</div>
      {sub && <div className="text-[11.5px] text-muted">{sub}</div>}
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await prisma.creator.findUnique({ where: { id }, select: { displayName: true } });
  return { title: c?.displayName ?? "Creator" };
}

export default async function CreatorProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ exists?: string }>;
}) {
  const ctx = await requireContext();
  const { id } = await params;
  const { exists } = await searchParams;
  const c = await getCreatorProfile(id, ctx.workspaceId);
  if (!c) notFound();

  const [notes, activity, lists, contentCount] = await Promise.all([
    prisma.note.findMany({
      where: { workspaceId: ctx.workspaceId, creatorId: id },
      include: { author: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.activityEvent.findMany({ where: { workspaceId: ctx.workspaceId, creatorId: id }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.prospectList.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { name: "asc" } }),
    prisma.contentItem.count({ where: { account: { creatorId: id } } }),
  ]);

  const prospect = c.prospects[0];
  const memberOf = new Set(prospect?.listItems.map((li) => li.list.id) ?? []);
  const completeness = dataCompleteness({ ...c, contentCount });
  const observed = c.signals.filter((s) => s.evidenceKind === "OBSERVED");
  const inferred = c.signals.filter((s) => s.evidenceKind === "INFERRED");
  const latestSat = c.scores.find((s) => s.kind === "SATURATION");
  const latestOpp = c.scores.find((s) => s.kind === "OPPORTUNITY");
  const series = c.accounts
    .filter((a) => a.snapshots.filter((s) => s.followers != null).length >= 2)
    .map((a) => ({
      label: `${PLATFORM_LABEL[a.platform]} @${a.handle}`,
      points: a.snapshots.filter((s) => s.followers != null).map((s) => ({ t: +s.capturedAt, followers: s.followers! })),
    }));

  return (
    <>
      {exists && (
        <div className="mb-4 rounded-xl border border-info/30 bg-info-soft px-4 py-2.5 text-[12.5px] text-info">
          That account is already in the database — here&apos;s the existing profile.
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <Avatar name={c.displayName} className="size-14 text-[17px]" />
          <div className="min-w-0">
            <Link href="/creators" className="text-[12px] font-medium text-muted hover:text-ink">← Creators</Link>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-semibold tracking-tight">{c.displayName}</h1>
              {c.isDemo && <Badge tone="warn">Demo · fictional</Badge>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
              <span>{c.primaryNiche ?? "Niche not classified"}</span>
              {c.country && <span>{COUNTRY_NAME[c.country] ?? c.country}</span>}
              {c.language && <span>{LANGUAGE_NAME[c.language] ?? c.language}</span>}
              <span>Discovered {fmtDate(c.discoveredAt)}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {c.accounts.map((a) => (
                <a
                  key={a.id}
                  href={a.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-[12px] font-medium text-ink-2 hover:text-ink"
                >
                  {PLATFORM_LABEL[a.platform]} · @{a.handle} <ExternalLink className="size-3" />
                </a>
              ))}
              {c.websiteUrl && (
                <a href={c.websiteUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-1 text-[12px] font-medium text-ink-2 hover:text-ink">
                  Website <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusSelect creatorId={c.id} status={prospect?.status ?? null} />
          <SaveButton creatorId={c.id} saved={!!prospect?.saved} withLabel />
          <ButtonLink href={`/compare?ids=${c.id}`}><Columns3 className="size-4" /> Compare</ButtonLink>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-5">
          {/* Key metrics */}
          <Card className="grid grid-cols-2 divide-line sm:grid-cols-3 lg:grid-cols-6 [&>*]:border-line max-sm:[&>*:nth-child(odd)]:border-r sm:[&>*:not(:last-child)]:border-r">
            <Stat label="Total followers" value={fmtCount(c.totalFollowers)} sub={`${c.accounts.length} account${c.accounts.length === 1 ? "" : "s"}`} />
            <Stat label="Engagement" value={fmtPct(c.engagementRate)} sub="follower-weighted" />
            <Stat
              label="30-day growth"
              value={<span className={cn(c.followerGrowth30d != null && c.followerGrowth30d > 0 && "text-good", c.followerGrowth30d != null && c.followerGrowth30d < 0 && "text-bad")}>{fmtGrowth(c.followerGrowth30d)}</span>}
              sub={c.followerGrowth30d == null ? "needs 21+ days history" : "from snapshots"}
            />
            <Stat label="Last post" value={fmtRelative(c.lastPostAt)} />
            <Stat label="Saturation" value={<ScorePill kind="saturation" value={c.saturationScore} confidence={c.scoreConfidence} />} />
            <Stat label="Opportunity" value={<ScorePill kind="opportunity" value={c.opportunityScore} confidence={c.scoreConfidence} />} />
          </Card>

          {c.bio && (
            <Card className="px-5 py-4">
              <div className="mb-1 text-[11.5px] font-medium text-muted">Public bio</div>
              <p className="whitespace-pre-line text-[13.5px] text-ink-2">{c.bio}</p>
            </Card>
          )}

          {/* Growth */}
          <Card>
            <CardHeader title="Audience growth" description="Measured from stored snapshots. We never extrapolate growth we haven't observed." />
            {series.length ? (
              <div className="px-3 py-4"><GrowthChart series={series} /></div>
            ) : (
              <EmptyState title="Not enough history yet">
                Growth appears once we have two or more follower snapshots. Saving metrics below (or a provider sync in
                Phase 2) records a snapshot each time.
              </EmptyState>
            )}
          </Card>

          {/* Scoring */}
          <Card>
            <CardHeader
              title="Scoring & explanation"
              description="Saturation (0–100, lower = less observed commercial activity) and Opportunity (0–100) with the evidence behind them."
            />
            {latestSat || latestOpp ? (
              <div className="grid gap-px bg-line sm:grid-cols-2">
                {[latestSat, latestOpp].filter(Boolean).map((s) => (
                  <div key={s!.id} className="bg-surface px-5 py-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold">{s!.kind === "SATURATION" ? "Saturation" : "Opportunity"}</span>
                      <ConfidenceMeter value={s!.confidence} />
                    </div>
                    <div className="mt-2 text-[28px] font-semibold tabular">{s!.value ?? "Insufficient data"}</div>
                    <ul className="mt-3 space-y-1.5 text-[12.5px]">
                      {(s!.breakdown as Breakdown).map((b, i) => (
                        <li key={i} className="flex items-start justify-between gap-3">
                          <span className="text-ink-2">
                            {b.factor}
                            {b.evidenceKind && <Badge tone={b.evidenceKind === "OBSERVED" ? "info" : "muted"} className="ml-1.5">{b.evidenceKind.toLowerCase()}</Badge>}
                            {b.note && <span className="block text-[11.5px] text-muted">{b.note}</span>}
                          </span>
                          {b.contribution != null && <span className="tabular font-medium">{b.contribution > 0 ? "+" : ""}{b.contribution}</span>}
                        </li>
                      ))}
                    </ul>
                    {s!.missingData.length > 0 && <p className="mt-3 text-[11.5px] text-muted">Missing: {s!.missingData.join(", ")}</p>}
                    <p className="mt-2 text-[11px] text-muted">{s!.version} · {fmtRelative(s!.computedAt)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-4">
                <p className="text-[13px] text-ink-2">
                  Not scored yet — the scoring engine is built in Phase 3. Below is the data it will use. Scores are only
                  produced when enough of it exists; otherwise the creator is shown as <em>insufficient data</em>, not as a
                  “low-saturation” prospect.
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <span className="text-[12px] font-medium text-muted">Data completeness</span>
                  <ConfidenceMeter value={completeness.score} />
                </div>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {completeness.checks.map((ch) => (
                    <li key={ch.key} className="flex gap-2 text-[12.5px]">
                      {ch.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-good" /> : <Circle className="mt-0.5 size-4 shrink-0 text-line-strong" />}
                      <span>
                        <span className={ch.ok ? "text-ink" : "text-ink-2"}>{ch.label}</span>
                        <span className="block text-[11.5px] text-muted">{ch.why}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {/* Commercial evidence */}
          <Card>
            <CardHeader
              title="Commercial evidence"
              description="Publicly visible monetisation. Absence of evidence is not evidence of absence — creators may monetise privately."
            />
            <div className="px-5 py-4">
              <div className="mb-3 flex flex-wrap gap-2 text-[12px]">
                <Badge tone="info"><Eye className="size-3" /> {observed.length} observed</Badge>
                <Badge tone="muted"><ShieldQuestion className="size-3" /> {inferred.length} inferred</Badge>
              </div>
              {c.signals.length === 0 ? (
                <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-[12.5px] text-muted">
                  No commercial signals recorded yet. This does <strong>not</strong> mean the creator is unmonetised —
                  {contentCount === 0 ? " we haven't analysed any of their content yet." : " only that we haven't seen it in the content we've analysed."}
                </p>
              ) : (
                <ul className="divide-y divide-line rounded-lg border border-line">
                  {c.signals.map((s) => (
                    <li key={s.id} className="flex items-start gap-3 px-3 py-2.5">
                      <Badge tone={s.evidenceKind === "OBSERVED" ? "info" : "muted"} className="mt-0.5">{SIGNAL_LABEL[s.type]}</Badge>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] text-ink-2">{s.evidence}</p>
                        <p className="mt-0.5 text-[11.5px] text-muted">
                          {s.evidenceKind === "OBSERVED" ? "Observed" : `Inferred (${Math.round(s.confidence * 100)}% conf.)`} · {SOURCE_LABEL[s.source]} · {fmtDate(s.observedAt)}
                          {s.sourceUrl && <> · <a href={s.sourceUrl} target="_blank" rel="noreferrer noopener" className="text-accent hover:underline">source</a></>}
                        </p>
                      </div>
                      {s.source === "MANUAL" && (
                        <form action={deleteCommercialSignal}>
                          <input type="hidden" name="signalId" value={s.id} />
                          <button title="Delete" className="rounded p-1 text-muted hover:bg-surface-2 hover:text-bad"><Trash2 className="size-3.5" /></button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <details className="mt-4">
                <summary className="cursor-pointer text-[12.5px] font-medium text-accent">Record evidence you observed</summary>
                <div className="mt-3"><SignalForm creatorId={c.id} /></div>
              </details>
            </div>
          </Card>

          {/* AI opportunities */}
          <Card>
            <CardHeader title="AI opportunity analysis" description="Monetisation ideas grounded in this creator's public content." />
            {c.analyses[0] ? (
              <pre className="overflow-x-auto px-5 py-4 text-[12px]">{JSON.stringify(c.analyses[0].opportunities, null, 2)}</pre>
            ) : (
              <EmptyState icon={<Lightbulb className="size-5" />} title="Arrives in Phase 4">
                Will produce audience interests, likely unmet needs, three monetisation ideas, a partnership approach and
                the evidence for each — every inference clearly labelled as such.
              </EmptyState>
            )}
          </Card>

          {/* Accounts */}
          <Card>
            <CardHeader title="Platform accounts" description="Where each number came from and how fresh it is." />
            <div className="divide-y divide-line">
              {c.accounts.map((a) => (
                <div key={a.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold">{PLATFORM_LABEL[a.platform]}</span>
                      <a href={a.url} target="_blank" rel="noreferrer noopener" className="text-[12.5px] text-accent hover:underline">@{a.handle}</a>
                    </div>
                    <span className="text-[11.5px] text-muted">{SOURCE_LABEL[a.source]} · updated {fmtRelative(a.fetchedAt)}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[12.5px] sm:grid-cols-5">
                    <div><span className="text-muted">Followers </span><span className="tabular font-medium">{fmtCount(a.followers)}</span></div>
                    <div><span className="text-muted">Avg views </span><span className="tabular font-medium">{fmtCount(a.avgViews)}</span></div>
                    <div><span className="text-muted">Engagement </span><span className="tabular font-medium">{fmtPct(a.engagementRate)}</span></div>
                    <div><span className="text-muted">Posts/30d </span><span className="tabular font-medium">{a.postsLast30d ?? "—"}</span></div>
                    <div><span className="text-muted">Snapshots </span><span className="tabular font-medium">{a.snapshots.length}</span></div>
                  </div>
                  {(a.source === "MANUAL" || a.source === "DEMO") && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-[12.5px] font-medium text-accent">Update metrics (records a snapshot)</summary>
                      <div className="mt-3"><MetricsForm account={a} /></div>
                    </details>
                  )}
                </div>
              ))}
              <div className="px-5 py-4">
                <details>
                  <summary className="cursor-pointer text-[12.5px] font-medium text-accent">Link another platform account</summary>
                  <div className="mt-3"><AddAccountForm creatorId={c.id} /></div>
                </details>
              </div>
            </div>
          </Card>
        </div>

        {/* Right rail */}
        <div className="space-y-5">
          <Card>
            <CardHeader title="Lists" />
            <div className="space-y-3 px-5 py-4">
              {lists.length === 0 && <p className="text-[12.5px] text-muted">No lists yet — create one below.</p>}
              <ul className="space-y-1.5">
                {lists.map((l) => {
                  const inList = memberOf.has(l.id);
                  return (
                    <li key={l.id} className="flex items-center justify-between gap-2">
                      <Link href={`/lists/${l.id}`} className="truncate text-[13px] hover:underline">{l.name}</Link>
                      <form action={inList ? removeFromList : addToList}>
                        <input type="hidden" name="creatorId" value={c.id} />
                        <input type="hidden" name="listId" value={l.id} />
                        <button className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-medium", inList ? "bg-accent-soft text-accent hover:bg-bad-soft hover:text-bad" : "border border-line text-ink-2 hover:bg-surface-2")}>
                          {inList ? <>Added <X className="size-3" /></> : "Add"}
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
              <NewListInline creatorId={c.id} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Notes" description="Private to your workspace" />
            <div className="space-y-4 px-5 py-4">
              <NoteForm creatorId={c.id} />
              {notes.map((n) => (
                <div key={n.id} className="rounded-lg border border-line bg-surface-2/50 px-3 py-2.5">
                  <p className="whitespace-pre-line text-[13px] text-ink-2">{n.body}</p>
                  <div className="mt-1.5 flex items-center justify-between text-[11.5px] text-muted">
                    <span>{n.author.name} · {fmtRelative(n.createdAt)}</span>
                    {n.author.id === ctx.user.id && (
                      <form action={deleteNote}>
                        <input type="hidden" name="noteId" value={n.id} />
                        <button className="hover:text-bad">Delete</button>
                      </form>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Activity" />
            {activity.length ? (
              <ol className="space-y-2.5 px-5 py-4">
                {activity.map((a) => (
                  <li key={a.id} className="flex gap-2.5 text-[12.5px]">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-line-strong" />
                    <span className="min-w-0">
                      <span className="text-ink-2">{describeActivity(a.type, a.payload)}</span>
                      <span className="block text-[11.5px] text-muted">{a.actorType === "USER" ? "You / teammate" : a.actorType.toLowerCase()} · {fmtRelative(a.createdAt)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="px-5 py-4 text-[12.5px] text-muted">No activity yet.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function describeActivity(type: string, payload: unknown): string {
  const p = (payload ?? {}) as Record<string, string>;
  switch (type) {
    case "prospect.status_changed": return `Status: ${p.from?.replace(/_/g, " ").toLowerCase()} → ${p.to?.replace(/_/g, " ").toLowerCase()}`;
    case "prospect.saved": return "Saved as prospect";
    case "prospect.unsaved": return "Removed from saved";
    case "note.added": return "Note added";
    case "list.item_added": return `Added to list “${p.list}”`;
    case "signal.added_manual": return `Evidence recorded: ${p.type?.replace(/_/g, " ").toLowerCase()}`;
    case "signal.deleted": return "Evidence removed";
    case "metrics.updated_manual": return "Metrics updated";
    case "account.added": return `Linked ${p.platform?.toLowerCase()} @${p.handle}`;
    case "creator.created_manual": return "Added manually";
    default: return type;
  }
}
