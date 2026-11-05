# DECISIONS LOG

Assumptions, ambiguities, and technical decisions made during planning. This document is updated whenever a product or technical rule is not explicitly stated in the PRD. Do not silently invent product behavior — record it here first.

---

## Decision Log Format

| # | Date | Area | Decision | Rationale | PRD Reference | Status |
|---|------|------|----------|-----------|---------------|--------|
| D-001 | 2026-11-04 | Tech Stack | Next.js App Router (latest stable at project start), React, TypeScript strict | PRD §11.2 & AGENTS §3 | §11.2 | Approved |
| D-002 | 2026-11-04 | UI | Tailwind CSS + shadcn/ui primitives (Radix) owned in repo; Lucide icons | PRD §11.2 & AGENTS §3 | §11.2 | Approved |
| D-003 | 2026-11-04 | Backend | Supabase: PostgreSQL + Auth + RLS; hosted; no service-role key in browser | PRD §11.2, §14 & AGENTS §3 | §11.2, §14 | Approved |
| D-004 | 2026-11-04 | Validation | Zod schemas shared between client and server; React Hook Form for complex forms | PRD §11.2 & AGENTS §3 | §11.2 | Approved |
| D-005 | 2026-11-04 | State | React state only; Zustand added only if clear need; no global store by default | PRD §11.1 & AGENTS §3 | §11.1 | Approved |
| D-006 | 2026-11-04 | Server State | Server Components first; TanStack Query added only where client interaction needs it | PRD §11.2 | §11.2 | Approved |
| D-007 | 2026-11-04 | Charts | Recharts for basic analytics only where meaningful | PRD §11.2 | §11.2 | Approved |
| D-008 | 2026-11-04 | Dates | date-fns + date-fns-tz; all timestamps stored UTC as timestamptz; rendered in user IANA timezone | PRD §11.2, §10 rule 9 | §11.2, §10 | Approved |
| D-009 | 2026-11-04 | Testing | Vitest + React Testing Library (unit/component); Playwright (E2E); axe-core for accessibility checks | PRD §11.2, §17 & AGENTS §3 | §11.2, §17 | Approved |
| D-010 | 2026-11-04 | Auth approach | Supabase Auth with cookie-based SSR sessions via `@supabase/ssr`; Next.js middleware for session refresh; verify Next.js 15 vs 16 (`middleware.ts` vs `proxy.ts`) at install | PRD §11.3 note about SSR beta and Next.js version | §11.3 | Approved — verify installed Next.js version before writing middleware |
| D-011 | 2026-11-04 | i18n | Custom lightweight i18n layer (translation JSON files per locale + keys) rather than a heavy framework, since only two locales (Arabic/English) are required in MVP. RTL via CSS `dir` and logical properties. | Only two locales; keeps bundle small; full control over RTL | §12, I18N-01/02 | Approved |
| D-012 | 2026-11-04 | Primary keys | UUID for all primary keys; `owner_id` = `auth.users.id` on every user-owned table | PRD §13.1 | §13.1 | Approved |
| D-013 | 2026-11-04 | Dates vs timestamps | `timestamptz` for exact moments; `date` for pure calendar dates (goal target day, scheduled_for); separate `due_at` (deadline) from `scheduled_for` (plan day) | PRD §13.1 | §13.1 | Approved |
| D-014 | 2026-11-04 | Active-cycle uniqueness | Partial unique index on `focus_cycles` WHERE `active = true` per `owner_id` | PRD §13.1, FOCUSC-05 | §13.1 | Approved |
| D-015 | 2026-11-04 | Primary-goal uniqueness | Partial unique index on `focus_cycle_goals` WHERE `role = 'primary'` per cycle | PRD §13.1, FOCUSC-02 | §13.1 | Approved |
| D-016 | 2026-11-04 | Secondary-goal limit | Max 2 secondary goals enforced in validated domain logic + DB CHECK/count; override requires conscious action + warning (not silent) | PRD FOCUSC-03, §10 rule 3 | FOCUSC-03 | Approved |
| D-017 | 2026-11-04 | Archive default | Entities with history (life_areas, goals, projects, focus_cycles) use `archived_at` soft-delete by default; hard delete only explicit | PRD §10 rule 11, §13.1 | §10, §13.1 | Approved |
| D-018 | 2026-11-04 | Task scheduling | No automatic rescheduling of incomplete tasks; user must consciously reschedule/return-to-inbox/cancel | PRD §10 rule 5, TASK-08 | §10, TASK-08 | Approved |
| D-019 | 2026-11-04 | Focus timer accuracy | Session duration computed from stored `started_at`/`paused_at`/`resumed_at`/`ended_at` timestamps, not a client JS counter only; survives page reload | PRD TIMER-05, §10 rule 8 | TIMER-05 | Approved |
| D-020 | 2026-11-04 | No site blocking | Focus Mode does not block sites/apps; UI states this clearly | PRD TIMER-07, §10 | TIMER-07 | Approved |
| D-021 | 2026-11-04 | Journal privacy | Journal/gratitude/review text never sent to analytics or AI; analytics uses an allowlist of non-text events | PRD §10 rule 12, §14.2, §18 | §10, §14.2 | Approved |
| D-022 | 2026-11-04 | Billing/payments | Explicitly out of MVP (Release 2). No pricing provider selected yet. | PRD §6.4, §8 | §6.4 | Approved |
| D-023 | 2026-11-04 | AI | No AI in MVP; future AI optional with explicit user consent | PRD §6.3, §8 | §6.3 | Approved |
| D-024 | 2026-11-04 | Collaboration/teams | No team workspaces or data sharing in MVP | PRD §6.4 | §6.4 | Approved |
| D-025 | 2026-11-04 | External calendar | No external calendar integration in MVP | PRD §6.4 | §6.4 | Approved |
| D-026 | 2026-11-04 | Subtasks depth | Limited depth (recommended max 2 levels); `parent_task_id` self-reference with application-level depth guard | PRD TASK-03 | TASK-03 | Approved |
| D-027 | 2026-11-04 | Top priorities | Up to 3 top-priority tasks per day; `is_top_priority` boolean + count enforced per user per day | PRD TASK-07 | TASK-07 | Approved |
| D-028 | 2026-11-04 | Maintenance goals | Supported as `focus_cycle_goals.role = 'maintenance'`; not treated as primary/secondary | PRD FOCUSC-04 | FOCUSC-04 | Approved |
| D-029 | 2026-11-04 | Energy level | Optional 1–5 integer, explicitly not medical/diagnostic | PRD JOUR-03, §14.2 | JOUR-03 | Approved |
| D-030 | 2026-11-04 | Deployment | Vercel + Supabase; region chosen after target markets defined | PRD §11.2 | §11.2 | Approved |
| D-031 | 2026-11-04 | Migrations | SQL migrations committed to Git; no manual production dashboard edits | PRD §11.1, AGENTS §7 | §11.1 | Approved |
| D-033 | 2026-11-04 | Rendering | Cache Components / partial prefetching disabled (`cacheComponents: false`, `reactStrictMode: true`); all `/app` routes are session-dependent and must render per request | Caching an authenticated shell would risk cross-request staleness for zero benefit | §11.2 | Approved |
| D-034 | 2026-11-04 | Next.js 16 | Session refresh lives in `src/proxy.ts` (Next 16 renamed the middleware entry point); `cookies()`, `headers()`, `params` and `searchParams` are awaited everywhere | Framework requirement; resolves D-032(a) | §11.3 | Approved |
| D-035 | 2026-11-04 | i18n implementation | Flat-key dictionaries with a typed `MessageKey` union; `ar` is declared `Record<MessageKey, string>` so missing keys fail typecheck. Locale comes from the `od-locale` cookie, then the profile column, defaulting to `en`; `dir` is derived from the locale. | Compile-time parity beats a runtime fallback that silently ships English to Arabic users. Resolves D-032(b) | §12, I18N-01/02 | Approved |
| D-036 | 2026-11-04 | Supabase typing | Row models are object `type` aliases (not `interface`) so they satisfy Supabase's `Record<string, unknown>` table constraint | `interface` lacks an index signature, which collapsed inserts/updates to `never` | §11.2 | Approved |
| D-037 | 2026-11-04 | Server action contract | Every mutation is `(prev: ActionState, formData: FormData) => Promise<ActionState>`; owner identity comes only from `requireUserId()`; inputs are Zod-validated; results are `idle/success/error` with a message key, never raw DB errors | Uniform UX, no user-supplied identity, no leaked internals | §11.1, §14 | Approved |
| D-038 | 2026-11-04 | Account deletion | Deletion calls `SECURITY DEFINER public.delete_own_account()` (operates on `auth.uid()` only, cascades from `auth.users`) and requires typing `DELETE`. Export is `GET /api/export` scoped to the session user. Retention policy remains D-032(c). | Users must be able to leave with their data, without a service-role key in the app | AUTH-07 | Approved |
| D-039 | 2026-11-04 | Top-3 priority scope | The three-priority limit is keyed to `owner_id` + `scheduled_for` day, enforced by a DB trigger; undated tasks are not priorities | Matches “three outcomes for today”, and the trigger protects the rule from any future code path | TASK-07 | Approved |
| D-040 | 2026-11-04 | Timer clock | The running timer reads an external clock store (`useSyncExternalStore`) and derives elapsed time from persisted timestamps; completed sessions display `actual_seconds` | No drift, no hydration-dependent counters, survives reload/second device (D-019) | TIMER-03/05 | Approved |
| D-041 | 2026-11-04 | Completion math | Cancelled tasks are excluded from completion percentages (goal, project and insight views all call one helper) | Deliberately dropped work must not read as failure | INS-02 | Approved |
| D-043 | 2026-11-04 | Referential ownership | Ownership is enforced with composite foreign keys on `(id, owner_id)` in addition to RLS, so a direct authenticated REST call cannot point a row at another user's record | RLS checks the row being written, not the rows it references; review F-01 | §14 | Approved |
| D-044 | 2026-11-04 | Multi-row invariants | Cycle creation and goal replacement run in database functions; deferred constraint triggers require exactly one primary goal and the secondary limit/override at commit | PostgREST offers no client transaction; review F-02/F-04 | FOCUSC-02/03 | Approved |
| D-045 | 2026-11-04 | Timer transitions | Pause/resume/end/interruption are conditional database functions; the app never writes a computed duration from a stale read | Replays and concurrent tabs must not corrupt focus history; review F-05 | TIMER-05 | Approved |
| D-046 | 2026-11-04 | Auth callbacks and export | Email redirects use `APP_URL`/`NEXT_PUBLIC_APP_URL` only (never host headers); export pages through every table instead of trusting one PostgREST response | Review F-07/F-08; header spoofing and silent row caps are security/data-loss risks | AUTH-07 | Approved |
| D-042 | 2026-11-04 | Test scope | Vitest + Testing Library unit/component coverage of domain rules, i18n parity and a11y primitives; Playwright E2E deferred until a Supabase project is available | E2E without a database would only test mocks and would misrepresent verification | §17 | Open |
| D-032 | 2026-11-04 | Open items / ambiguities | (a) Exact Next.js version (15 vs 16) determines `middleware.ts` vs `proxy.ts` — verify at install. (b) Exact i18n library choice — lightweight custom chosen; revisit if translation surface grows. (c) Retention period for account deletion — to be defined with legal before commercial release. | PRD §11.3 note, §14.3 | — | Open |

---

## How to use this log

- Before implementing behavior not explicitly covered by the PRD, add a decision row here.
- If a decision conflicts with the PRD, flag it and document the resolution per AGENTS §1.
- Review this log before each implementation slice.