# Roadmap

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation, database, auth, dashboard, creator management | ✅ **Done** |
| 2 | Discovery + provider integrations (YouTube first; Instagram Business Discovery; provider adapter interface; job runner; daily snapshots) | Next |
| 3 | Intelligence: rule-based signal detection, Saturation Score, Opportunity Score, confidence, explanations | |
| 4 | AI opportunity analysis (audience needs, 3 ideas, partnership approach, evidence) | |
| 5 | Advanced filtering, saved searches, ranking tuning, bulk actions, team invites | |
| 6 | Agent framework: research / discovery / analysis / outreach agents with human approval | |

## Phase 1 — completion report

**Built**
- Next.js 16 + TypeScript + Prisma 7 + PostgreSQL project, full schema and initial migration
- Email/password auth (better-auth), auto-created personal workspace, route protection
- Dashboard with all requested tiles, pipeline summary, niche distribution chart
- Creator database: search, filters (niche, platform, size tier, followers, engagement, 30-day growth,
  country, language, commercial activity, saturation, opportunity, status, list, saved, demo), sortable
  columns, pagination, filters in URL
- Creator profile: metrics with provenance, snapshot-based growth chart, scoring panel with
  data-completeness checklist, commercial evidence (observed vs inferred), notes, status, lists, activity
- Save, notes, statuses, lists, pipeline board, compare (up to 4), CSV export (formula-injection safe)
- Manual creator entry with duplicate detection; manual metric snapshots; manual evidence
- Settings: provider catalogue with credential status; demo data load/remove
- Fictional demo dataset, flagged and badged everywhere

**Verified**
- `npm test`: 11 unit tests (rollups, growth, filters, CSV, completeness) pass
- `npm run build` + `tsc` clean
- End-to-end browser run of 25 checks: sign-up, dashboard, sort, filters, empty states, save, status
  change + audit log, notes, list create/add, evidence, metric snapshot, compare, pipeline, list detail,
  export, saved filter, settings, manual add, duplicate detection, validation errors, mobile layout
  (no horizontal overflow), unauthenticated export → 401, unauthenticated page → redirect to login.
  No browser console errors.
- Database operations verified directly in Postgres (counts, rollups, cascades on demo removal).

**Deliberately not built yet:** discovery, scoring, AI. Their UI states say so instead of showing
placeholder numbers.

## What I need from you before/during Phase 2

1. **YouTube Data API key** (free): Google Cloud Console → new project → enable *YouTube Data API v3*
   → Credentials → *API key*. Put it in `.env` as `YOUTUBE_API_KEY`.
2. **Hosting decision** (can wait): Vercel + Neon is the lowest-effort option.
3. **Optional, later:** a Meta developer app + Instagram Business account for Business Discovery.
4. **Repository:** approve moving this folder into its own repository.
