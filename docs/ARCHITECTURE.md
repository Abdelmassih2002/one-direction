# ARCHITECTURE

Source of truth: PRD §11 (Technical Design), AGENTS §3–7.

---

## 1. Product & Stack Summary

ONE DIRECTION is a B2C SaaS Personal Life Operating System — a responsive web application with Arabic RTL and English LTR. Users manage Life Areas → Goals → Focus Cycles → Projects/Milestones/Tasks → Daily Plan → Focus Sessions → Reviews → Insights.

**Approved stack (PRD §11.2):**
- Framework: Next.js App Router + TypeScript (strict)
- UI: React + Tailwind CSS; shadcn/ui + Radix primitives; Lucide icons
- Backend: Supabase PostgreSQL + Auth + Row Level Security; hosted
- Auth: Supabase Auth with cookie-based SSR sessions
- Data access: Supabase JS + SQL migrations; types generated from schema
- Forms: React Hook Form + Zod
- State: React state; Zustand only if proven necessary
- Server state: Server Components first; TanStack Query only where interaction needs it
- Charts: Recharts (basic analytics only)
- Dates: date-fns + date-fns-tz (UTC storage, local rendering)
- Testing: Vitest + React Testing Library; Playwright E2E; axe-core accessibility
- Hosting: Vercel + Supabase
- CI: GitHub Actions (lint, typecheck, tests, build)

---

## 2. High-Level Data Flow

```
Browser (Responsive UI, RTL/LTR)
        |
        v
Next.js App Router
  |-- Server Components  (read/render; fetch from Supabase with user session)
  |-- Client Components  (interactions, timers, local UI state; "use client")
  |-- Server Actions     (validated mutations via Zod; run on server)
  |-- Route Handlers     (webhooks/integrations only; none in MVP core)
        |
        v
Application / Domain Services
  |-- Goals & Focus Cycles
  |-- Projects & Tasks
  |-- Scheduling & Focus Sessions
  |-- Reviews & Insights
        |
        v
Supabase
  |-- Auth (users, sessions, cookies)
  |-- PostgreSQL + RLS (every user table: auth.uid() = owner_id)
  |-- Storage (optional, later; not in MVP)
```

### Read flow
1. Middleware/SSR validates the Supabase session cookie.
2. Server Component loads data for the current `owner_id` from Supabase.
3. PostgreSQL RLS scopes every query to `auth.uid() = owner_id`.
4. Minimal required data is sent to the client.

### Write flow
1. Client submits a form or action.
2. Server Action validates input with Zod (server-side, even if client validated).
3. Ownership is derived from the session (`auth.uid()`), never trusted from client payload.
4. Domain service enforces business rules (one active cycle, one primary goal, max 2 secondary, no auto-reschedule).
5. Supabase RLS enforces ownership at the database layer as a second line of defense.

---

## 3. Directory Structure (App Router)

```
F:\ONE DIRECTION\
├── app\
│   ├── layout.tsx                 # Root layout (lang dir, i18n, theme, providers)
│   ├── page.tsx                   # Marketing home (/)
│   ├── auth/
│   │   ├── sign-up/
│   │   ├── sign-in/
│   │   └── forgot-password/
│   ├── onboarding/
│   ├── app/                       # authenticated shell
│   │   ├── layout.tsx             # Sidebar, top nav, auth check
│   │   ├── today/                 # Today Dashboard + Daily Plan
│   │   ├── life/                  # Life Areas
│   │   ├── goals/
│   │   ├── focus-cycle/
│   │   ├── projects/
│   │   ├── tasks/
│   │   ├── focus/
│   │   ├── journal/
│   │   ├── reviews/
│   │   ├── insights/
│   │   └── settings/
│   ├── api/                       # Route handlers (webhooks only; none in MVP core)
│   └── middleware.ts              # Supabase session refresh (proxy.ts if Next.js 16)
├── components\
│   ├── ui\                        # shadcn/ui base primitives (button, dialog, etc.)
│   ├── focus-cycle\               # domain components
│   ├── goals\
│   ├── life-areas\
│   ├── projects\
│   ├── tasks\
│   ├── schedule\
│   ├── journal\
│   ├── reviews\
│   ├── insights\
│   ├── settings\
│   └── shared\                    # i18n, date formatting, RTL helpers
├── lib\
│   ├── supabase\
│   │   ├── server.ts              # Supabase client for Server Components / Server Actions
│   │   ├── client.ts              # Supabase client for browser (with cookies)
│   │   └── middleware.ts          # SSR session helper
│   ├── services\                  # domain services (business logic)
│   │   ├── goalService.ts
│   │   ├── focusCycleService.ts
│   │   ├── projectService.ts
│   │   ├── taskService.ts
│   │   ├── sessionService.ts
│   │   └── reviewService.ts
│   ├── validations\               # Zod schemas
│   │   ├── auth.schema.ts
│   │   ├── goal.schema.ts
│   │   ├── task.schema.ts
│   │   └── ...
│   ├── utils\                     # date-fns helpers, i18n, cn(), class-variance-authority
│   └── types\                     # generated Supabase DB types + local TS types
├── migrations\                    # SQL migrations (committed to Git)
├── public\
├── tests\
│   ├── unit\                      # Vitest
│   ├── integration\               # Vitest + DB
│   ├── e2e\                       # Playwright
│   └── fixtures\
├── docs\
├── .env.example
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 4. Database Schema Overview

All user-owned tables include `owner_id UUID REFERENCES auth.users(id)` and RLS policy `auth.uid() = owner_id`. Primary keys are UUIDs. Timestamps are `timestamptz` stored in UTC.

### Core tables

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `profiles` | User preferences | id (auth.users.id), locale, timezone, week_start, created_at |
| `life_areas` | Life domains | id, owner_id, name, color, sort_order, archived_at |
| `goals` | Goals | id, owner_id, life_area_id, title, description, metric, status, progress, target_date, archived_at |
| `goal_history` | (P1) audit | id, goal_id, changed_at, from_status, to_status |
| `focus_cycles` | Active focus period | id, owner_id, start_date, end_date, duration_weeks, active, archived_at |
| `focus_cycle_goals` | Cycle goal assignment | id, cycle_id, goal_id, role (primary/secondary/maintenance) |
| `projects` | Projects | id, owner_id, goal_id, title, status, archived_at |
| `milestones` | Project phases | id, project_id, title, sort_order, due_date |
| `tasks` | Tasks & subtasks | id, owner_id, goal_id, project_id, milestone_id, parent_task_id, title, status, scheduled_for (date), due_at (timestamptz), estimate_minutes, is_top_priority, sort_order, archived_at |
| `schedule_blocks` | Time blocks | id, owner_id, block_type, title, start_at, end_at, date |
| `focus_sessions` | Timer sessions | id, owner_id, task_id, started_at, paused_at, resumed_at, ended_at, planned_seconds, actual_seconds, interruptions, notes, status |
| `daily_reviews` | Daily journal | id, owner_id, review_date, achievement, blocker, next_step, gratitude, energy_level |
| `weekly_reviews` | Weekly journal | id, owner_id, week_start, achievements, blockers, open_tasks, focus_adjustment |

### Security constraints

- **Partial unique index:** one active cycle per user: `CREATE UNIQUE INDEX ON focus_cycles(owner_id) WHERE active = true;`
- **Partial unique index:** one primary goal per cycle: `CREATE UNIQUE INDEX ON focus_cycle_goals(cycle_id) WHERE role = 'primary';`
- **CHECK constraints:** `goals.status`, `projects.status`, `tasks.status`, `energy_level` between 1 and 5, `focus_cycle_goals.role` in ('primary','secondary','maintenance').
- **RLS:** `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` + policy `CREATE POLICY ... USING (auth.uid() = owner_id);` on every user table.
- **Ownership derived server-side:** `owner_id` never accepted from client payload in Server Actions.

---

## 5. Authentication & Session Security

- Supabase Auth handles sign-up, sign-in, password recovery, session cookies.
- Next.js middleware refreshes the session cookie on each request (`@supabase/ssr`).
- Server Components and Server Actions obtain the user via the server-side Supabase client; `auth.uid()` is the source of truth for ownership.
- The Supabase service-role key is **never** exposed to the browser or committed to source control.
- Anonymous/expired sessions are redirected to `/auth/sign-in`; protected `/app/*` routes require a valid session.

---

## 6. Security Boundaries

| Boundary | Control |
|----------|---------|
| Client → Server | All input validated with Zod on the server; `owner_id` from session, not client |
| Server → DB | Supabase client bound to user session; RLS enforces `auth.uid() = owner_id` |
| Cross-account | RLS prevents user A from reading/writing user B's rows even with known UUID |
| Secrets | Service-role key only in server env vars; `.env.example` has placeholders only |
| Journal text | Never sent to analytics; allowlisted analytics events only |
| Session | Cookie-based; refreshed via middleware; sign-out invalidates |

---

## 7. Internationalization (i18n) & RTL

- Two locales: `en` (LTR) and `ar` (RTL).
- User locale stored in `profiles.locale`; persisted and changeable in settings.
- Direction derived from locale: `dir="rtl"` for Arabic, `dir="ltr"` for English, set on `<html>`.
- Layout uses CSS logical properties (`margin-inline-start`, `padding-inline-end`, etc.) so the same components work in both directions.
- Directional icons (chevrons, arrows) mirrored for RTL.
- Dates/numbers formatted with `date-fns` + `date-fns-tz` using the user's IANA timezone and locale.
- Week start respected from `profiles.week_start`.

---

## 8. Responsive Design

- Mobile-first breakpoints (shadcn/ui/Tailwind defaults).
- Desktop: fixed sidebar + main content.
- Tablet: collapsible sidebar.
- Mobile: bottom navigation or drawer; touch-friendly targets.
- No core function depends on hover or drag-and-drop only; keyboard/button alternatives provided.

---

## 9. Deployment & CI

- Vercel hosts the Next.js app; environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` server-only) set in Vercel.
- Supabase hosts PostgreSQL + Auth; separate Dev/Staging/Prod projects.
- SQL migrations in `/migrations` applied via Supabase CLI.
- GitHub Actions runs: lint → typecheck → unit tests → E2E → production build on every PR and merge.
- `.env.example` committed with placeholder values; real secrets never committed.

---

## 10. Testing Strategy

- **Unit (Vitest):** domain rules (one active cycle, one primary goal, max 2 secondary, timer duration from timestamps, top-priority limit, timezone conversion).
- **Integration (Vitest + DB):** create goal → link life area; create cycle → assign goals; inbox → task; project → milestone → task; session pause/resume/end; review save; RLS cross-account isolation.
- **Security/RLS:** user A cannot read/write user B's records; no client-supplied `owner_id` spoofing; unauthenticated access rejected; new tables require RLS + tests.
- **E2E (Playwright):** signup → onboarding → area → goal → cycle → project → milestone → task → complete; session start/pause/resume/end; daily/weekly review; locale switch to Arabic + RTL check; mobile narrow-width flow; account deletion.
- **Accessibility:** axe-core on critical paths; keyboard navigation; contrast; focus visible.