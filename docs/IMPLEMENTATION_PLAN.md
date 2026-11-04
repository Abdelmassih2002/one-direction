# IMPLEMENTATION PLAN

Vertical slices, each ending in a runnable, testable state. Follow AGENTS.md workflow: implement one slice, run lint/typecheck/tests/build, fix regressions, then continue. Keep `docs/IMPLEMENTATION_STATUS.md` current.

---

## Slice 0 — Foundation (Infrastructure, Auth, i18n, Design System, Testing)

Goal: A runnable Next.js app with Supabase Auth, RLS foundation, i18n (en/ar), design system, and test tooling. No business features yet.

Tasks:
- Initialize Next.js App Router + TypeScript strict project
- Install Tailwind + shadcn/ui base + Lucide + date-fns/date-fns-tz + zod + react-hook-form
- Configure Supabase project (Dev) and `@supabase/ssr` + middleware session refresh
- Create `lib/supabase/server.ts`, `client.ts`, `middleware.ts`
- Create `.env.example` with placeholder secrets
- Set up i18n layer (translation JSONs for en/ar; `dir` on `<html>`; locale from profile)
- Set up design-system tokens + first shadcn components (button, input, dialog, toast, etc.)
- Configure Vitest + React Testing Library + Playwright + axe-core + ESLint + Prettier
- GitHub Actions workflow: lint → typecheck → tests → build
- First SQL migration: `profiles`, `auth.users` (Supabase-managed), RLS on profiles
- Smoke test: sign-up → sign-in → sign-out; protected route redirects unauthenticated

Exit gate: User can sign up, sign in, sign out; data isolated by RLS; en/ar locale switch works on a sample page; lint/typecheck/tests/build all pass.

---

## Slice 1 — Life Areas & Goals

Goal: Users can manage life areas and goals (CRUD + states + archive).

Tasks:
- Migration: `life_areas`, `goals` (+ owner_id, RLS, indexes, CHECK constraints)
- Domain service: `goalService`, `lifeAreaService` with Zod validation
- Server Actions: create/update/archive life area & goal (owner_id from session)
- Pages: `/app/life` (list + reorder + archive), `/app/goals` (list + detail + create/edit)
- Components: life area list, goal list, goal detail, status selector, archive dialog
- i18n strings for life/goals; RTL-aware layouts
- Tests: unit (goal states, life area archive), integration (create goal → link life area), RLS cross-account

Exit gate: User can create/edit/archive a life area and a goal; goals linked to life area; archive excludes from active views; RLS enforced; tests pass.

---

## Slice 2 — Focus Cycles

Goal: One active cycle; one primary goal; up to two secondary; DB-enforced.

Tasks:
- Migration: `focus_cycles`, `focus_cycle_goals`; partial unique indexes (active cycle per user; primary goal per cycle)
- Domain service: `focusCycleService` enforcing cycle rules (create/close, assign primary/secondary/maintenance)
- Server Actions: create cycle, assign goals, close cycle with outcome
- Pages: `/app/focus-cycle` (current cycle, goal assignment, history)
- Components: cycle goal picker (primary + up to 2 secondary with warning), cycle close/outcome dialog
- i18n strings; RTL
- Tests: unit (one active cycle, one primary, max 2 secondary), integration (create cycle → assign goals → close), RLS

Exit gate: User can create exactly one active cycle with one primary and up to two secondary goals; DB rejects violations; cycle close requires outcome; tests pass.

---

## Slice 3 — Projects, Tasks & Today

Goal: Convert goals into actionable daily work; conscious rescheduling; top 3 priorities.

Tasks:
- Migration: `projects`, `milestones`, `tasks` (incl. parent_task_id, scheduled_for, due_at, estimate_minutes, is_top_priority)
- Domain service: `projectService`, `taskService` (no auto-reschedule, top-3 limit, depth limit for subtasks)
- Server Actions: CRUD for projects/milestones/tasks; reorder; mark top priority; reschedule
- Pages: `/app/projects`, `/app/projects/[id]`, `/app/tasks` (inbox + list + filters), `/app/today` (dashboard + top 3 + plan)
- Components: project list/detail, milestone list, task list, task create/edit (quick capture title-only), today dashboard, schedule block editor
- i18n strings; RTL; keyboard reorder alternative
- Tests: unit (top-3 limit, no auto-reschedule, subtask depth), integration (project→milestone→task→complete), RLS

Exit gate: User can create project/milestone/task; today shows top 3 priorities; tasks not auto-rescheduled; RLS enforced; tests pass.

---

## Slice 4 — Focus Sessions & Schedule

Goal: Reliable timestamp-based timer; pause/resume/end; schedule blocks for focus/rest.

Tasks:
- Migration: `schedule_blocks`, `focus_sessions`
- Domain service: `sessionService` (duration from timestamps; pause/resume; end)
- Client timer component (reads stored timestamps on mount/reload; no JS-counter-only duration)
- Pages: `/app/focus` (active session + quick capture + end), schedule block editor on `/app/today`
- Components: focus mode (task only, timer, pause/resume/end, interruption counter, notes), schedule blocks (focus/rest/personal/commitment), overlap warning
- i18n strings; RTL; timer recovery after page refresh
- Tests: unit (duration from timestamps incl. pauses), integration (start→pause→resume→end → verify actual_seconds), RLS

Exit gate: User can start/pause/resume/end a focus session; duration accurate after reload; schedule blocks creatable with overlap warning; tests pass.

---

## Slice 5 — Journal, Reviews & Insights

Goal: Daily/weekly/cycle reviews; basic insights; journal text excluded from analytics.

Tasks:
- Migration: `daily_reviews`, `weekly_reviews`
- Domain service: `reviewService`, `insightService` (aggregates only; no journal text in analytics)
- Pages: `/app/journal` (daily review + gratitude + energy 1–5), `/app/reviews` (weekly + cycle), `/app/insights` (weekly summary, goal progress)
- Components: daily review form, weekly review form, insights cards + simple Recharts charts
- Analytics allowlist (non-text events only)
- i18n strings; RTL
- Tests: unit (energy 1–5 range, aggregates), integration (save daily/weekly review linked to user), RLS

Exit gate: User can save daily and weekly reviews; insights reflect actual data; journal text not in analytics events; tests pass.

---

## Slice 6 — Settings, Export & Account Deletion

Goal: Account management, data export, deletion.

Tasks:
- Migration: none new (use existing tables)
- Domain service: `settingsService` (export JSON of all owner rows; delete account + dependent records)
- Page: `/app/settings` (profile, locale, timezone, week start, export, delete)
- Components: settings form, export JSON download, delete confirmation dialog
- i18n strings; RTL
- Tests: integration (export returns only owner's data; deletion removes access), RLS

Exit gate: User can update profile/locale/timezone; export own JSON; delete account with confirmation; tests pass.

---

## Slice 7 — Hardening & Private Beta Readiness

Goal: Security audit, performance, accessibility, E2E critical paths, docs.

Tasks:
- RLS audit: verify every user table has RLS + ownership policy; cross-account isolation tests pass
- E2E critical paths (Playwright): signup→onboarding→area→goal→cycle→project→task→complete; session start/pause/resume/end; daily/weekly review; Arabic RTL switch; mobile narrow width; account deletion
- axe-core WCAG 2.2 AA checks on critical paths
- Performance: LCP/INP/CLS targets; production build
- Docs: `.env.example`, setup instructions, migration instructions, deployment instructions, known limitations
- `docs/IMPLEMENTATION_STATUS.md` finalized

Exit gate: All E2E critical paths pass; RLS audit passes; WCAG AA on critical paths; production build clean; documentation complete.

---

## Definition of Done per Slice (from AGENTS §10)

- Matches PRD with traceable acceptance criteria
- Works in Arabic RTL and English LTR
- Works on mobile and desktop
- Loading, empty, error, success, validation states handled
- Server-side validation
- Authorization/ownership at data layer (RLS)
- Automated tests included
- No new TypeScript/lint/build errors
- No secrets/private content/fake data/TODOs shipped
- Documentation + IMPLEMENTATION_STATUS updated