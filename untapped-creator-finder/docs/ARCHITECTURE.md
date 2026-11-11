# Architecture, costs and limitations

## 1. Environment inspection (Nov 2026)

| Item | Found | Decision |
|---|---|---|
| Runtime | Node 22 | Target Node ≥ 20.9 (Next.js 16 minimum) |
| Database | PostgreSQL 16 available locally | Use Postgres everywhere (dev = prod) |
| Repos available | `CashX-bot` (Telegram casino bot), `CashX-Casino` (static page) | Neither is related. The app lives in its own folder `untapped-creator-finder/` inside `CashX-bot` because no new repository could be created from this session. **Recommended:** move it to its own repo (`git subtree split -P untapped-creator-finder`) — it has no dependency on the bot code. |
| Docker | Not available | Not needed |

## 2. Stack (and why)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16 (App Router) + React 19, TypeScript** | One codebase for UI + API. Server Components query the DB directly — fast pages, no separate API server to host. |
| Database | **PostgreSQL** | Relational CRM data + JSON for score breakdowns + arrays for niches. Free tiers on Neon/Supabase. |
| ORM | **Prisma 7** (`@prisma/adapter-pg`) | Typed queries, migrations. v7 has no Rust engine → smaller, serverless-friendly. |
| Auth | **better-auth** (email/password) | Self-hosted, no per-user fees, sessions in our own DB. Google/Microsoft SSO and organisations are plug-ins later. |
| UI | **Tailwind CSS 4**, hand-built components, **Recharts**, **lucide** icons | Distinct look (not a stock template), no heavy UI kit. |
| Validation | **Zod** | Every form/action input is validated server-side. |
| Jobs (Phase 2+) | **Postgres-backed `Job` table** | No Redis bill. Move to a queue service only when volume demands it. |
| Tests | **Vitest** (logic) + Playwright (end-to-end, run during development) | |

Deliberately *not* used: microservices, Redis, Kubernetes, a vector DB, paid UI kits.

## 3. Code layout

```
prisma/schema.prisma        data model (read the header comment first)
src/app/(auth)/             login / signup
src/app/(app)/              signed-in product: dashboard, creators, pipeline, lists, compare, settings
src/app/(app)/actions.ts    all mutations (server actions) — validated, workspace-scoped, audit-logged
src/app/api/                auth handler, CSV export
src/server/                 domain logic, no UI
  creators.ts               queries (filters → SQL, dashboard aggregates)
  filters.ts                URL ⇄ filter parsing (shared by table and export)
  metrics.ts                PURE calculations (rollups, growth) — unit tested
  rollup.ts                 writes denormalised rollups onto Creator
  completeness.ts           which data we have / need → future score confidence
  activity.ts               append-only audit log (users now, agents later)
  providers/registry.ts     data-source catalogue + credential status
  demo.ts                   fictional dataset generator
src/components/             UI
```

## 4. Data model in one paragraph

**Shared intelligence** (facts about the public world): `Creator` → many `PlatformAccount`
(one per YouTube/Instagram/TikTok presence) → `MetricSnapshot` (point-in-time metrics; growth is
computed from these, never guessed) and `ContentItem` (public posts). `CommercialSignal` records each
piece of monetisation evidence with **`evidenceKind` = OBSERVED or INFERRED**, its source and a link.
`CreatorScore` stores each scoring run with its full **breakdown**, **confidence** and **missing data**,
and allows `value = NULL` for "insufficient data". `OpportunityAnalysis` stores AI output.
**Workspace-private CRM**: `Prospect` (status, saved), `Note`, `ProspectList`. `ActivityEvent` logs every
change with an actor type (USER / AGENT / SYSTEM). `Job` is the queue for discovery, scoring and agents.

Creator rows carry **rollups** (total followers, weighted engagement, 30-day growth, signal count,
latest scores) so the table sorts/filters with indexed columns instead of joins. **NULL always means
unknown, never zero** — this is how "don't reward missing information" is enforced at the data layer.

## 5. Data sources — what is actually possible

| Platform | Legitimate route | Discovery (search)? | Cost | Reality check |
|---|---|---|---|---|
| YouTube | YouTube Data API v3 | **Yes** | Free, 10k units/day | Best MVP source. ~100 searches/day + thousands of cheap channel/video lookups. |
| Instagram | Graph API *Business Discovery* | **No** — lookup by known username only | Free | Needs a Meta app + your own IG Business account; only Business/Creator accounts visible. |
| TikTok | Research API | Restricted | Free but gated | Approval-only, aimed at qualifying non-commercial research. Assume **unavailable** for us directly. |
| All three | Licensed data provider (e.g. creator-data APIs) | Yes | Paid | The realistic route for Instagram/TikTok discovery at scale. Check terms on storage and sourcing. |

We will **not** scrape logged-in pages, bypass rate limits or collect private data.

## 6. Running costs

| Stage | Monthly | What |
|---|---|---|
| Local / MVP validation | **$0** | Local Postgres, YouTube API free tier, manual Instagram/TikTok entry |
| Hosted MVP | **~$0–25** | Vercel Hobby/Pro or Railway + Neon/Supabase free/low tier |
| + AI analysis (Phase 4) | **+$5–50** | Small Claude model, cached per creator, only for shortlisted creators |
| + paid creator data | **+$100–1,000+** | Only once the YouTube-only MVP proves the scoring is valuable |

## 7. How to launch the MVP cheaply

1. **YouTube first.** It is the only platform with free, legitimate *search*. The intelligence engine is
   platform-agnostic, so the method is proven on YouTube and extended later.
2. **Instagram/TikTok by enrichment, not discovery.** Many YouTube creators link their IG/TikTok; we
   record those handles and enrich via Business Discovery or manual entry.
3. **Snapshot daily, compute growth ourselves.** Growth history is our moat — it accumulates for free
   and can't be bought retroactively.
4. **Rules before AI.** Sponsorship/affiliate detection is mostly pattern-matching (`#ad`, "use code",
   affiliate domains). Spend AI tokens only on shortlisted creators.
5. **Buy data last**, once paying users want Instagram/TikTok coverage.

## 8. Known limitations

- Engagement is computed from public likes/comments/views; it can't see saves, shares or audience
  demographics, and is distorted by bought engagement.
- "Low saturation" means *little observed commercial activity*, **not** "rarely contacted". Inbox
  volume is invisible to everyone.
- YouTube rounds subscriber counts (3 significant figures) — growth on small channels is coarse.
- Creator facts are shared across workspaces. Manual edits by one workspace are visible to others; in a
  multi-tenant launch, manual overrides should become workspace-scoped (small schema change).
- Single workspace per user for now; team invites come with the CRM module.

## 9. Future agents (Phase 6) — why the foundation already fits

Agents are just new *writers* into the same tables, through the same domain functions:
discovery agent → `PlatformAccount`/`ContentItem`; research agent → `CommercialSignal (INFERRED)`;
analysis agent → `OpportunityAnalysis`; outreach agent → `Prospect` + a future `OutreachMessage`.
Each runs as a `Job`, and every write is attributed in `ActivityEvent` with `actorType = AGENT`, so a
human can review, approve or roll back automated work.
