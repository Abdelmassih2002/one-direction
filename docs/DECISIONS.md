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
| D-032 | 2026-11-04 | Open items / ambiguities | (a) Exact Next.js version (15 vs 16) determines `middleware.ts` vs `proxy.ts` — verify at install. (b) Exact i18n library choice — lightweight custom chosen; revisit if translation surface grows. (c) Retention period for account deletion — to be defined with legal before commercial release. | PRD §11.3 note, §14.3 | — | Open |

---

## How to use this log

- Before implementing behavior not explicitly covered by the PRD, add a decision row here.
- If a decision conflicts with the PRD, flag it and document the resolution per AGENTS §1.
- Review this log before each implementation slice.