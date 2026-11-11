# Untapped — Creator Intelligence

Find promising, **overlooked** creators and the commercial opportunities around them —
with the evidence behind every number.

> Status: **Phase 1 complete** (foundation, database, dashboard, creator management).
> See [`docs/ROADMAP.md`](docs/ROADMAP.md) for what's done and what's next, and
> [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the design, costs and limitations.

## Run it locally

Requirements: Node 20.9+ and PostgreSQL 14+.

```bash
cd untapped-creator-finder
npm install
cp .env.example .env              # then set DATABASE_URL and BETTER_AUTH_SECRET
npx prisma migrate deploy         # create tables
npm run db:seed-demo              # optional: 36 clearly-labelled FICTIONAL creators
npm run dev                       # http://localhost:3000 -> create an account
```

Create a local database quickly:

```bash
sudo -u postgres psql -c "CREATE USER ucf WITH PASSWORD 'ucf_dev' CREATEDB;" -c "CREATE DATABASE ucf OWNER ucf;"
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build && npm start` | Production build / server |
| `npm test` | Unit tests (pure scoring/metrics/CSV/filter logic) |
| `npm run typecheck` | TypeScript check |
| `npm run db:migrate` | Create a new migration after editing `prisma/schema.prisma` |
| `npm run db:seed-demo` / `db:clear-demo` | Load / remove fictional demo data |

## What works today

- Email + password accounts, a private workspace per user
- Dashboard: totals, high-opportunity / low-saturation tiles (activate in Phase 3), recently
  discovered, needs-research, saved, pipeline, niche distribution
- Creator database: search, 15 filters, sortable columns, pagination, shareable URLs
- Creator profile: metrics with source + freshness, growth chart from real snapshots,
  commercial evidence (observed vs inferred), data-completeness checklist, notes,
  status, lists, activity log
- Save prospects, prospect lists, pipeline board, compare up to 4 creators, CSV export
- Manual creator entry, manual metric snapshots, manual evidence recording
- Settings: data-provider status with exactly which credentials each needs

Not yet built (and not faked): automated discovery, scoring, AI analysis. Those screens
say so explicitly.
