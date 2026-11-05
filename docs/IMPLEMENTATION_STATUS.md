# IMPLEMENTATION STATUSLast updated: 2026-11-05 (post final hardening review round V5)

## Current Phase

Hardening complete in source; live database verification still blocked on Supabase credentials. The MVP
surfaces and review findings F-01…F-13 are addressed in source. V5 findings V5-01…V5-07 (archive script,
canary tests, npm command, concurrency assertions, and status wording) have been implemented and the
checks that can run without a database have been executed.

## Code-review findings

| ID | Severity | Status | Evidence / remaining gap |
| --- | --- | --- | --- |
| F-01 | High | Fixed — implemented, not runtime-verified | `migrations/003_hardening.sql` §A adds `(id, owner_id)` unique keys and composite FKs for goals→life areas, tasks→goal/project/milestone/parent, schedule blocks→task, focus sessions→task, cycle goals→cycle/goal, projects→goal, milestones→project. Friendly ownership checks added in goal and schedule actions. Needs the two-account REST test. |
| F-02 | High | Fixed — implemented, not runtime-verified | `create_focus_cycle` and `set_cycle_goal_assignments` RPCs replace the delete-then-insert sequence; deferred constraint triggers require exactly one primary and the secondary limit/override. Actions call the RPCs. |
| F-03 | High | Fixed — implemented, not runtime-verified | `validate_task_links` walks the proposed parent chain with a visited array and rejects cycles and depth > 2. Integration test covers the two-node cycle. |
| F-04 | Medium | Fixed — implemented, not runtime-verified | Top-priority trigger takes a transaction advisory lock per owner+day before counting; secondary limit/override is persisted (`focus_cycles.secondary_override`) and enforced in the RPC + deferred trigger. |
| F-05 | Medium | Fixed — implemented, not runtime-verified | `pause_focus_session`, `resume_focus_session`, `end_focus_session` (row lock) and `increment_focus_interruptions` are conditional, atomic transitions; actions no longer read-then-write. |
| F-06 | Medium | Fixed — implemented, not runtime-verified | `finish_onboarding` creates goal + cycle + primary assignment + onboarding flag in one function call; the multi-step action is gone. |
| F-07 | Medium | Fixed + unit-tested | `resolveAppUrl` uses `APP_URL`/`NEXT_PUBLIC_APP_URL` only; headers no longer build callbacks. `tests/unit/app-url.test.ts` covers forged/absent config. |
| F-08 | Medium | Fixed + unit-tested | Export pages every table with `.range()` in `id` order and fails with 500 instead of truncating; `tests/unit/paginate.test.ts` covers full pages, empty pages and mid-stream failure. |
| F-09 | Medium | Fixed | `parent_task_id` is now part of the update payload in `updateTaskAction`. |
| F-10 | Low | Fixed + unit-tested | `nextQuarterHourLocal` uses the profile timezone; tested for UTC, Cairo and the midnight edge. |
| F-11 | Medium | Fixed + unit-tested | `assertRead` throws on read errors in every authenticated page, and `app/error.tsx` + root `error.tsx` render a recoverable state instead of a fake empty state; covered in `tests/unit/paginate.test.ts`. |
| F-12 | Low | Fixed | Migration 001 now drops policies before creating them. CREATE TABLE / CREATE INDEX statements are not idempotent, so migrations are applied by migration history, not rerun against an existing database. README and status are worded to that effect. |
| F-13 | Low | Fixed | `.env.example` has no service-role key and documents `NEXT_PUBLIC_APP_URL` plus the two-account test variables. `scripts/build-archive.sh` excludes every `.env*` file at every depth and validates the root `.env.example` before including it; `scripts/test-build-archive.sh` (wired as `npm run test:archive`) asserts the archive excludes nested `.env.local`/`.env.production`/`.env.staging`/nested `.env.example`, accepts the safe root `.env.example`, rejects a credential-bearing root `.env.example`, and detects a canary secret anywhere in the tree. README documents `test:archive`. |
| F-14 | High | Verified against PGlite | `migrations/004_integrity_hardening.sql` §A: both-cycle invariant validation on assignment moves/deletes via deferred constraint trigger; DELETE reads `OLD.cycle_id`; `_assert_cycle_role_invariants` revoked from PUBLIC unconditionally, and from anon/authenticated when those roles exist. The existing PUBLIC `pg_roles`-gated guard would never fire (PUBLIC is a pseudo-role), and is replaced here. Verified by `scripts/verify-migrations.mjs` (PGlite) including the explicit anon/authenticated/`PUBLIC`-inheritance checks added in this round. |
| F-15 | High | Implemented; sequential behaviour verified against PGlite; concurrency verification not complete | `migrations/004_integrity_hardening.sql` §B: per-owner `pg_advisory_xact_lock` serialises hierarchy edits; subtree depth re-validated on move. `scripts/verify-migrations.mjs` (PGlite) exercises the lock function and validates sequential cycle/depth behaviour; this does **not** prove concurrent serialisation under two live transactions. The two-client and three-client concurrency tests in `tests/integration/hardening.test.ts` use two independent authenticated clients with verified user IDs and require exactly one winner and the expected domain error (`task_cycle_detected` / `task_self_parent`) on the loser; they are skipped unless real `TEST_USER_*` credentials are set. Until those run, F-15 is not claimed as runtime-verified for concurrent races. |
| F-16 | High | Implemented; privilege and timer behaviour verified against PGlite | `migrations/004_integrity_hardening.sql` §C/D: `focus_sessions` table privileges revoked from `authenticated`/`anon` (SELECT + UPDATE(notes) only); timer RPCs granted to `authenticated` only; `guard_focus_session_insert` enforces `started_at` presence and non-future. `start_focus_session()` is the only creation path (server-clock `started_at`). Verified by `scripts/verify-migrations.mjs` (PGlite) for the privilege matrix and sequential transitions; timer replay under concurrent live transactions still depends on the skipped Supabase integration suite. |

## Verification performed (this round)

| Check | Command | Result |
| --- | --- | --- || Typecheck | `npx tsc --noEmit` | 0 errors |
| Lint | `npx eslint src tests scripts` | 0 errors |
| Unit/component tests | `npx vitest run` | 53 tests / 10 files passed |
| Integration suite | `npx vitest run --config vitest.integration.config.ts` | 17 tests skipped — no test accounts configured |
| PGlite migration + behaviour verification | `node scripts/verify-migrations.mjs` | 48/48 checks passed |
| Archive canary fixtures | `bash scripts/test-build-archive.sh` | 10/10 passed |
| npm-run integration | `npm run test:archive` | 10/10 passed |
| Source archive | `bash scripts/build-archive.sh` | wrote one-direction-source.tar.gz (302,409 bytes) |### PGlite verification vs live Supabase verification

PGlite (`node scripts/verify-migrations.mjs`) proves the SQL parses, runs, triggers behave, and the privilege matrix matches migration 004 claims. It uses a WASM-compiled PostgreSQL engine with a minimal Supabase shim (`auth.users`, `auth.uid()`, `anon`/`authenticated`/`service_role`). It does **not** prove PostgREST/GoTrue wiring or RLS under a real JWT.

PGlite exercises the F-15 advisory lock function and validates sequential hierarchy, cycle, and depth behaviour. It does **not** run two concurrent authenticated transactions against the same owner, so it does **not** verify concurrent serialisation; that claim depends on the skipped Supabase integration tests.

Live Supabase verification requires a real project and two test accounts (`TEST_USER_*` variables) and is **not** run or claimed as passed in this workspace.

| Check | Method | Result |
|---|---|---|
| Migrations 001–004 apply in order | PGlite | applied without error |
| F-14 cycle invariants (source cycle on move, OLD on delete) | PGlite | passed |
| F-15 hierarchy serialisation, cycles, subtree depth (sequential) | PGlite | passed |
| F-15 concurrent two-client race | live Supabase integration (skipped) | not run |
| F-16 privilege matrix (no INSERT/UPDATE table privileges, notes-only column grant, RPC execute; `_assert_cycle_role_invariants` callable **only** from the trigger — not anon, not authenticated, not PUBLIC-inherited) | PGlite | see latest run below |
| F-16 timer transitions (start/pause/resume/end state machine) | PGlite | see latest run below |
| Cross-owner isolation (user B cannot read user A's sessions) | PGlite | see latest run below |

## Not verified (blocked, not skipped)

- **Live Supabase execution**: migrations 001–004 have been executed and behaviour-verified
  against PGlite (see the table above), but have **not** been applied to a real Supabase project.
  This machine has no `psql`, Docker, or Supabase CLI, and no project credentials.
  RLS under a real JWT, PostgREST/GoTrue wiring, and end-to-end database behaviour remain
  unverified until applied to a real PostgreSQL 15+ project.
- Two-account REST tests for ownership (F-01), cycle atomicity (F-02), hierarchy cycles (F-03),
  concurrent priorities (F-04) and timer replay (F-05) exist in `tests/integration` but skipped
  (no test accounts configured).
- Sign-up → callback → session, RLS isolation, export contents, account deletion cascade, and browser
  RTL checks against real data remain unverified.
- Playwright E2E and CI are still absent (D-042).

## Next action

Apply `001`–`004` to a Supabase project, confirm that `authenticated` is the effective role for app
users, create two test users, set the four `TEST_USER_*` variables, and run `npm run test:integration`.
Record the results here before any external beta.

## Known risks

- `003` requires PostgreSQL 15+ for `ON DELETE SET NULL (column)`; Supabase projects meet this, older
  self-hosted Postgres does not.
- Existing active cycles with zero primary goals (possible only from pre-003 data) will fail the new
  deferred invariant on their next update; repair such rows before deploying.
- Retention policy for deleted accounts is still undefined (D-032c).
