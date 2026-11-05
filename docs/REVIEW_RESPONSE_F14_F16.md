# Response to the final review: CR-01…CR-12

This is the reviewer-facing resolution memo for the post-hardening findings.
It records what changed, what I fixed, and what still cannot be claimed
without a live database.

Change timing: the code changes below were made after the previous review
round, in response to the CR-01…CR-12 list in
`docs/ONE_DIRECTION_FINAL_REVIEW_F14_F16.md`-style direction.

Status at time of writing: code resolved, typecheck, lint and unit tests
pass, integration tests skip on this machine, migrations not executed.

Do not claim production readiness without live database verification.

## CR-01 — Migration 004 GRANT/REVOKE syntax

Status: resolved.

Changed: `migrations/004_integrity_hardening.sql`

What changed:

- All table-privilege statements now use the standard PostgreSQL form:
  `grant insert, select, update (notes) on focus_sessions to authenticated;`
  and `revoke update on focus_sessions from authenticated;`
- The previous `EDITORS`-oriented forms were replaced with the built-in
  `authenticated` role.
- Timer functions are explicit `SECURITY DEFINER` with tight search paths.

Open runtime caveat: the table grant still depends on `authenticated`
existing as the effective role in the target project. That is a standard
Supabase role, not a custom one, but the effective privilege matrix should
still be observed after migration 004 is applied.

## CR-02 — F-14 DELETE trigger

Status: resolved.

Changed: `migrations/004_integrity_hardening.sql`

What changed:

- `assert_cycle_role_invariants()` now branches on `tg_op` strictly:
  - `DELETE` → validate `old.cycle_id`
  - `INSERT` → validate `new.cycle_id`
  - `UPDATE` → validate `old.cycle_id`, plus `new.cycle_id` when they
    differ.

The shared `_assert_cycle_role_invariants(p_cycle_id)` function is reused,
so both-cycle validation is consistent across statements.

## CR-03 — hashtextextended argument types

Status: resolved.

Changed: `migrations/004_integrity_hardening.sql`

What changed:

- The per-owner advisory lock now passes valid `integer` arguments:
  `hashtextextended('tasks_hierarchy'::varchar, nullif(..., 0))`.
- A `null owner_id` check is added before locking so the function does not
  fail on unexpected input.

## CR-04 — actual Supabase authenticated role

Status: resolved.

Changed: `migrations/004_integrity_hardening.sql`

What changed:

- The custom `EDITORS` role is removed from the F-16 privilege story.
- Hardening now targets `authenticated`, which is the built-in Supabase
  role used for signed-in app users.
- Execute on the timer functions is granted to `authenticated` and revoked
  from `PUBLIC`.
- No service-role key is introduced anywhere; the browser client remains
  on the generated anon path.

Runtime caveat: if the target project authenticates app users differently,
the grant targets must be adjusted before trusting the migration.

## CR-05 — secure start_focus_session RPC

Status: resolved.

Changed:

- `migrations/004_integrity_hardening.sql` — added
  `public.create_focus_session(p_task_id uuid, p_planned_seconds integer)`
- `src/server/actions/focus.ts` — `startSessionAction` now calls the RPC
  instead of inserting through the table

What changed:

- The start path is now fully inside a `SECURITY DEFINER` function that
  derives identity from `auth.uid()` through `security_invoker_auditor()`,
  checks for an open session, checks task ownership, and inserts a
  `running` session with server-computed `started_at`.
- The previous client-computed insert path is removed from the action.

## CR-06 — fabricated timestamps and direct timer mutations

Status: resolved.

Changed:

- `migrations/004_integrity_hardening.sql` — `guard_focus_session_insert()`
  and F-16 privilege tables
- `src/server/actions/focus.ts` — start path moved to RPC
- `tests/integration/hardening.test.ts` — assertion targets updated

What changed:

- Direct inserts with non-`running` status, `ended_at`, or nonzero
  `actual_seconds` / `accumulated_seconds` are rejected.
- Direct authenticated `UPDATE` on timer columns is removed by the
  `authenticated` table grant/revoke.
- Notes editing is preserved through the explicit column grant and
  `saveSessionNoteAction`.

## CR-07 — F-14 test setup

Status: resolved.

Changed: `tests/integration/hardening.test.ts`

What changed:

- Each F-14 test now creates the primary goal first and assigns it before
  any secondary/maintenance assignment or cross-cycle move.
- Two-cycle scenarios explicitly create and assign both cycles first.

## CR-08 — concurrency result handling

Status: resolved.

Changed: `tests/integration/hardening.test.ts`

What changed:

- The two concurrent updates are now awaited with `Promise.all` and
  asserted on the real Supabase response `{ data, error }` shape, not on a
  `PromiseSettledResult` value heuristic.
- At least one of the two raced updates must return a non-null `error`.

## CR-09 — three-node race rebuild

Status: resolved.

Changed: `tests/integration/hardening.test.ts`

What changed:

- The test now starts from `A → B`, then races `B → C` against `C → A`
  from a second signed-in client.
- After the race, the test re-reads all three rows, walks from `A`, and
  asserts there is no cycle.

## CR-10 — descendant depth on re-parenting

Status: resolved.

Changed: `migrations/004_integrity_hardening.sql`

What changed:

- `validate_task_links()` now also walks descendant depth when
  re-parenting an existing task, so a move under a deeper parent can be
  rejected if any descendant path would exceed the project’s two-level
  nesting rule.

## CR-11 — archive script output

Status: resolved.

Changed: `scripts/build-archive.sh`

What changed:

- The archive now writes to `$OUTDIR` (default `.`) instead of a temporary
  directory that was deleted at exit.
- `mktemp` cleanup trap is removed for the archive path.

Verified: `bash scripts/build-archive.sh` ran successfully here and wrote
`one-direction-source.tar.gz` in the current directory.

## CR-12 — documentation

Status: resolved.

Changed:

- `docs/IMPLEMENTATION_STATUS.md` — F-13 rewritten, F-14/F-15/F-16 rows
  added, verification table updated.
- `README.md` — migration 004 described accurately, packaging caveat kept.
- `docs/REVIEW_RESPONSE_F14_F16.md` — this file.

## What is still blocked

- PostgreSQL is not available on this machine (`docker: none`,
  `supabase: none`, no `psql` discovered).
- I created a disposable setup plan in `scripts/prepare-test-db.sh` and a
  Docker Compose file `docker-compose.107.test.yml`, but could not start
  the database.
- Migration 004 has not been executed against any PostgreSQL instance.
- The integration suite is skipped; the hardening tests are not executed
  and not claimed as passes.
- F-16 role-name gating must be confirmed against the real Supabase
  project.

## Honest conclusion

CR-01…CR-12 are resolved in code and in tests that can run without a
database. The remaining runtime gate is: apply 001–004 to a staging
Supabase project, verify the role/privilege matrix, create two test
accounts, set `TEST_USER_*`, and run `npm run test:integration`. Do not
mark any of F-14/F-15/F-16 as verified before that.

Do not claim production readiness without live database verification.
