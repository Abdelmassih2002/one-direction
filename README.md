# ONE DIRECTION

A bilingual (Arabic RTL / English LTR) personal life operating system: life areas → goals → projects →
tasks, a weekly **focus cycle**, a **Focus Mode** timer, a daily journal, weekly reviews, and insights.

Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, and Supabase
(PostgreSQL + Auth + Row Level Security). The product specification lives in
[`docs/ONE_DIRECTION_PRD_Tech_Plan_AR.md`](docs/ONE_DIRECTION_PRD_Tech_Plan_AR.md); engineering
decisions and status are tracked in [`docs/DECISIONS.md`](docs/DECISIONS.md) and
[`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md).

## Requirements

- Node.js 20.9+ (developed on Node 22)
- A Supabase project (free tier is fine) — or the Supabase CLI for local development
- npm 10+

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the two values below
```

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API → `anon` / publishable key |
| `NEXT_PUBLIC_APP_URL` | Canonical origin used in auth email callbacks (e.g. `http://localhost:3000`) |

Only the anon key is used, and only server-side. **Never** put a service-role key in this project: no
code path needs it, and Row Level Security is the security boundary.

### Database

Run the migrations in order against your Supabase database (SQL editor, or `supabase db push` if you
use the CLI):

1. `migrations/001_initial_schema.sql` — profiles, life areas, goals, focus cycles + RLS
2. `migrations/002_core_domains.sql` — projects, milestones, tasks, schedule blocks, focus sessions,
   daily/weekly reviews, ownership triggers, RLS policies, and `delete_own_account()`
3. `migrations/003_hardening.sql` — composite ownership foreign keys, cycle-safe task hierarchy,
   concurrency-safe priorities, transactional cycle/onboarding functions, atomic timer transitions
4. `migrations/004_integrity_hardening.sql` — both-cycle invariant validation on assignment moves,
   per-owner serialisation of hierarchy edits, and timer-state-machine privilege hardening

Apply migrations in strict order by migration history, not by rerunning them. Statements such as CREATE
TABLE and CREATE INDEX are not idempotent. Migration 001 drops policies before recreating them, but the
underlying table/index creation still runs once. Migration 003 requires PostgreSQL 15+ (Supabase projects
qualify). Migration 004 adds privilege and function changes that are conditioned on the target role names
and must be reviewed against the actual Supabase project before trusting them. A `profiles` row is created
automatically for each new `auth.users` row by trigger.

In Supabase → Authentication → URL Configuration, set the **Site URL** to your deployment origin and
add `http://localhost:3000/auth/callback` (plus your production `/auth/callback`) to the redirect
allow-list. Email confirmation uses that callback to exchange the PKCE code for a session.

### Run

```bash
npm run dev        # http://localhost:3000
```

Without Supabase variables the marketing and auth screens still render, and the app shell explains
that setup is required — it never pretends to be signed in.

### Source archive (handoff)

`bash scripts/build-archive.sh` produces `one-direction-source.tar.gz` in the current directory (override with
`ARCHIVE_NAME=` and `ARCHIVE_DIR=`). It excludes build output, `node_modules`, caches, logs, `.next`, `.vercel`,
ereditor dirs, backups, and **every `.env*` file at every depth**. The only env file that can be included is the
validated root `.env.example`, and only when every value is a placeholder — real credentials cause the script to
exit 1 before archiving. The canary suite `npm run test:archive` exercises nested `.env.local`, `.env.production`,
`.env.staging`, nested `.env.example`, a safe root `.env.example`, a credential-bearing root `.env.example`, and a
canary-secret leak check.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (Next.js core-web-vitals + React hooks/compiler rules) |
| `npm test` | Vitest unit/component suite |
| `npm run test:watch` | Vitest in watch mode |
| `bash scripts/build-archive.sh` | Source-only archive for handoff (excludes build output, deps, logs, secrets, caches) |

## Architecture at a glance

- `src/proxy.ts` — Next.js 16 request proxy: refreshes the Supabase session cookie and guards
  `/app/**` and `/onboarding`.
- `src/app/(marketing)` / `src/app/auth/**` — public pages and Supabase email/password flows
  (sign-up, sign-in, forgot/reset password, PKCE callback, check-email).
- `src/app/app/**` — authenticated shell: Today, Focus Cycle, Life Areas, Goals, Projects, Tasks,
  Focus Mode, Journal, Reviews, Insights, Settings.
- `src/server/actions/**` — all mutations ("use server"). Every action derives the owner from the
  session (`requireUserId()`), never from form input, then re-checks ownership in the query.
- `src/lib/domain/**` — pure business rules (cycle limits, top-3 priorities, task depth, timer math,
  schedule overlap, progress aggregation). Unit-tested in `tests/unit`.
- `src/lib/i18n/**` — typed flat-key dictionaries. `ar` is typed as `Record<MessageKey, string>`, so a
  missing Arabic translation fails the build instead of silently falling back.
- `migrations/**` — schema, constraints, triggers, and RLS policies. The database is the second line
  of defence behind the server actions.

### Security model

- RLS is enabled on every user-owned table; policies match `owner_id = auth.uid()` (and `id =
  auth.uid()` for `profiles`).
- Cross-owner references (a task pointing at someone else's goal) are rejected by triggers.
- The top-3 priority rule, one-active-cycle rule, one-primary-goal rule and one-open-session rule are
  enforced by the database, so a bug in one action cannot corrupt another user's invariants.
- Journal/review text is never sent to analytics; there is no AI processing in the MVP.
- Account deletion runs through `SECURITY DEFINER public.delete_own_account()`, which only acts on
  `auth.uid()` and cascades from `auth.users`. Export is `GET /api/export`, scoped to the caller.
- All authenticated responses are dynamic and `no-store` by nature (session read per request);
  `next.config.ts` deliberately disables Cache Components for that reason.

## Testing

```bash
npm run typecheck && npm run lint && npm test && npm run test:archive && npm run build
```

`tests/unit` covers timer derivation, cycle validation, task bucketing/priority limits, schedule
overlap detection, week-start math, progress aggregation, canonical URL resolution, local schedule
defaults, bilingual key parity/placeholders, and accessible UI primitives.

Database and security behaviour is covered by the integration suite in `tests/integration/`, which talks
to a real project through the authenticated REST API with **two** accounts:

- `tests/integration/ownership.test.ts` — cross-owner links, task-tree cycles, cycle atomicity,
  concurrent priorities, timer replay, parent persistence, and atomic onboarding. Skips unless the
  `TEST_USER_*` variables are set.
- `tests/integration/hardening.test.ts` — F-14 (both-cycle invariant validation on assignment moves),
  F-15 (concurrent two-node and three-node cycle races against the same owner), and F-16 (direct-DML
  timer-state mutations rejected and timer RPCs still reachable). These skip unless the same two-account
  variables are set, AND are **not** run or claimed as passes here because this workspace has no live
  Supabase project.

```bash
NEXT_PUBLIC_SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_ANON_KEY=… \
TEST_USER_A_EMAIL=… TEST_USER_A_PASSWORD=… \
TEST_USER_B_EMAIL=… TEST_USER_B_PASSWORD=… \
npm run test:integration
```

## Known limitations (honest status)

- **No live Supabase project is configured in this workspace.** Authentication, RLS enforcement,
  persistence of every mutation, the export endpoint, timer persistence and the SQL migrations have
  been implemented and type-checked, but have **not** been executed against a real database here.
  End-to-end verification requires the environment variables above, the migrations applied, and the
  two-account integration run.
- The F-16 timer hardening in `migrations/004_integrity_hardening.sql` revokes all table-level
  privileges from `authenticated` and `anon` on `focus_sessions` (leaving only SELECT and
  UPDATE(notes)), revokes EXECUTE on all timer functions from PUBLIC and anon, and grants EXECUTE
  to `authenticated`. It also hardens `_assert_cycle_role_invariants` against PUBLIC/anon/authenticated
  execution and validates `started_at` integrity on session insertion. The resulting privilege matrix
  must be verified against the actual Supabase project; if the target instance uses different role or
  grant names, the GRANT/REVOKE statements in that migration must be adapted before trusting them.
  **No service-role key is used anywhere in the client.**
- Migration 004 (`migrations/004_integrity_hardening.sql`) adds:
  - both-cycle invariant validation on focus-cycle goal assignment moves and deletes (F-14),
  - per-owner transaction advisory locks plus subtree depth re-validation on task moves (F-15),
  - timer-state-machine privilege hardening so `focus_sessions` is only mutable through the
    transition RPCs (F-16),
  - a `started_at` integrity guard on new sessions.
- Playwright E2E and axe accessibility runs are not yet wired into CI (unit/component tests only).
- Focus Mode intentionally does not block websites or apps; it is a timer plus interruption tracking.
- Billing, AI coaching, team workspaces, and external calendar sync are explicitly out of the MVP.
- Retention window for deleted accounts is not yet a documented legal policy (see `docs/DECISIONS.md`).
- The workspace still carries build logs, `dev.log`, and `.next` artifacts. They are excluded from the
  source-only archive produced by `bash scripts/build-archive.sh` and from `.gitignore`, but are still
  present in the working tree until cleaned.
- The archive script excludes ALL `.env*` files (including `.env.staging` and nested `.env*`); only a
  validated, placeholder-only root `.env.example` may be included.

## Deployment

Deploy to Vercel (or any Node host) with the two public Supabase variables set as environment
variables in the hosting project, then add the deployed `/auth/callback` URL to Supabase's redirect
allow-list. Apply the migrations to the production database before the first sign-up.
