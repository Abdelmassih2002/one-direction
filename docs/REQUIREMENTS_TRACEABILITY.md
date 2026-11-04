# REQUIREMENTS TRACEABILITY MATRIX

Source of truth: `docs/ONE_DIRECTION_PRD_Tech_Plan_AR.md` (Arabic PRD) and `AGENTS.md`.

Priority key: **P0** = required for MVP launch; **P1** = next release; **P2** = future.

Each row maps: PRD Requirement → UI Route / Component → Database Entity / RLS Policy → Test Case(s).

---

## 9.1 Account & Authentication

| PRD ID | Requirement | Pri | UI Route / Component | Database Entity / RLS Policy | Test Case |
|--------|-------------|-----|----------------------|------------------------------|-----------|
| AUTH-01 | Create account with email + password; email verification; handled used-email errors | P0 | `/auth/sign-up` (Server + Client form with Zod) | `auth.users` (Supabase Auth); `profiles` (owner_id = auth.uid()); RLS: `auth.uid() = owner_id` on profiles | Sign-up with new email creates user + profile; duplicate email shows friendly error; unverified email cannot access /app/* |
| AUTH-02 | Sign in / sign out; no /app access without valid session | P0 | `/auth/sign-in`; sign-out button in header/settings | Supabase Auth session cookie; middleware/session refresh | Invalid credentials rejected; signing out redirects to /auth/sign-in; protected routes redirect unauthenticated to sign-in |
| AUTH-03 | Password reset via secure time-limited link | P0 | `/auth/forgot-password`, reset page | Supabase Auth password recovery | Reset link expires; new password allows sign-in |
| AUTH-04 | Secure session management; sign-out on expiry/revocation | P0 | Session refresh in layout/middleware | Supabase Auth cookie session | Session survives page refresh; expired session forces re-auth |
| AUTH-05 | Profile settings: name, language, timezone, week start | P0 | `/app/settings` | `profiles` table; RLS `auth.uid() = owner_id` | Update profile persists; only owner can update own profile |
| AUTH-06 | Account deletion with clear confirmation | P0 | `/app/settings` (danger zone) | `profiles` + all user-owned tables deleted via RLS/trigger | Deleted user cannot sign in; their data is removed/hidden per retention policy |
| AUTH-07 | Export personal data as structured JSON | P0 | `/app/settings` | All owner-scoped tables queried with `auth.uid()` | Export endpoint returns all user-owned rows; no other user's data included |

---

## 9.2 Onboarding

| PRD ID | Requirement | Pri | UI Route / Component | Database Entity / RLS Policy | Test Case |
|--------|-------------|-----|----------------------|------------------------------|-----------|
| ONB-01 | Set language, timezone, week start; changeable later | P0 | `/onboarding` wizard steps | `profiles.locale`, `profiles.timezone`, `profiles.week_start` | Onboarding saves preferences; editable in settings |
| ONB-02 | Choose life areas (templates or custom, skippable) | P0 | `/onboarding` | `life_areas` with RLS | Created life areas belong to onboarding user |
| ONB-03 | Create first goal (title required; desc/date/metric optional) | P0 | `/onboarding` | `goals` + `life_areas` link; RLS | Goal created linked to life area and owner |
| ONB-04 | Create first Focus Cycle (one active max, one primary goal) | P0 | `/onboarding` | `focus_cycles` + `focus_cycle_goals`; partial unique index on active cycle | Only one active cycle per user; primary goal enforced |
| ONB-05 | Gradual setup; save progress without forcing all fields | P0 | `/onboarding` multi-step | All above | Partial onboarding can be resumed; no forced completion |

---

## 9.3 Life Areas

| PRD ID | Requirement | Pri | UI Route / Component | Database Entity / RLS Policy | Test Case |
|--------|-------------|-----|----------------------|------------------------------|-----------|
| LIFE-01 | Create/edit/delete/archive life area; no cascade delete of linked records without clear policy | P0 | `/app/life` | `life_areas` (archived boolean); RLS `auth.uid() = owner_id` | Archive keeps linked goals/history; delete requires explicit confirmation |
| LIFE-02 | Reorder life areas; non-drag alternative required | P0 | `/app/life` list | `life_areas.sort_order`; RLS | Reorder persists; keyboard/button alternative works |
| LIFE-03 | Optional life area templates; editable, not imposed | P0 | Onboarding + `/app/life` | `life_areas.is_template` flag (optional) | Template applied then customizable |
| LIFE-04 | Area status (active/archived); archive keeps history | P0 | `/app/life` | `life_areas.archived_at`; RLS | Archived areas excluded from active priorities but history retained |

---

## 9.4 Goals

| PRD ID | Requirement | Pri | UI Route / Component | Database Entity / RLS Policy | Test Case |
|--------|-------------|-----|----------------------|------------------------------|-----------|
| GOAL-01 | Create goal linked to a life area; no due date required | P0 | `/app/goals` + create form | `goals` (life_area_id, owner_id); RLS | Goal created without due date succeeds |
| GOAL-02 | Goal states: Planned, Active, Maintenance, On Hold, Completed, Archived | P0 | Goal detail + status selector | `goals.status` CHECK constraint; RLS | All six states storable; transitions allowed per domain rules |
| GOAL-03 | Define outcome / optional metric | P0 | Goal create/edit | `goals.description`, `goals.metric` | Optional metric saved |
| GOAL-04 | Manual progress update (optional, no auto-measurement claims) | P0 | Goal detail | `goals.progress` (numeric/manual); RLS | Manual progress updated; no auto-computed claim in UI |
| GOAL-05 | Basic change log (P1) | P1 | Goal detail history | `goal_history` (optional audit table) | Status changes logged |
| GOAL-06 | Archive goal; keeps history; excluded from current priorities | P0 | Goal detail archive | `goals.archived_at`; RLS | Archived goal not shown in Today/active lists |

---

## 9.5 Focus Cycles

| PRD ID | Requirement | Pri | UI Route / Component | Database Entity / RLS Policy | Test Case |
|--------|-------------|-----|----------------------|------------------------------|-----------|
| FOCUSC-01 | Create focus cycle; default 4 weeks, range 2–6 weeks | P0 | `/app/focus-cycle` | `focus_cycles` (start_date, end_date, duration_weeks); RLS | Cycle duration within 2–6 weeks; default 4 |
| FOCUSC-02 | Exactly one Primary Goal per cycle | P0 | `/app/focus-cycle` goal assignment | `focus_cycle_goals.role = 'primary'`; partial unique index per cycle | Only one primary per cycle enforced at DB level |
| FOCUSC-03 | Up to two Secondary Goals (recommended); override only via conscious action + warning | P0 | `/app/focus-cycle` | `focus_cycle_goals.role = 'secondary'`; count check | Max 2 secondary; override requires confirmation |
| FOCUSC-04 | Maintenance goal for level-keeping activities (not primary) | P0 | `/app/focus-cycle` | `focus_cycle_goals.role = 'maintenance'` | Maintenance goals exist but aren't primary/secondary |
| FOCUSC-05 | One active cycle per user (enforced at DB) | P0 | `/app/focus-cycle` | Partial unique index `focus_cycles` WHERE active = true per owner_id | Second active cycle creation rejected by DB |
| FOCUSC-06 | Cycle completion requires outcome: achieved, progress, direction change, paused | P0 | Cycle review/close | `focus_cycles.outcome`; RLS | Cannot close without selecting outcome |
| FOCUSC-07 | Previous cycles preserved read-only; past results not silently modified | P0 | `/app/focus-cycle` history | `focus_cycles.archived_at`; RLS | Old cycles viewable, not editable |

---

## 9.6 Projects & Milestones

| PRD ID | Requirement | Pri | UI Route / Component | Database Entity / RLS Policy | Test Case |
|--------|-------------|-----|----------------------|------------------------------|-----------|
| PROJ-01 | Create project linked to a goal | P0 | `/app/projects` + from goal | `projects` (goal_id, owner_id); RLS | Project linked to owner's goal only |
| PROJ-02 | Project states: Planned, Active, On Hold, Completed, Archived | P0 | Project detail status | `projects.status` CHECK; RLS | All states storable |
| PROJ-03 | Milestones: create/edit/order; link tasks | P0 | Project detail | `milestones` (project_id, sort_order); RLS | Milestone belongs to project's goal owner |
| PROJ-04 | Project detail page: linked goal, current milestone, open tasks, progress | P0 | `/app/projects/[id]` | Joined query projects→goals→milestones→tasks | Page loads correct aggregates |
| PROJ-05 | Archive project; keeps completed tasks/session logs | P0 | Project detail archive | `projects.archived_at`; RLS | Archive retains task/session history |

---

## 9.7 Tasks & Inbox

| PRD ID | Requirement | Pri | UI Route / Component | Database Entity / RLS Policy | Test Case |
|--------|-------------|-----|----------------------|------------------------------|-----------|
| TASK-01 | Quick-create task: title only required | P0 | `/app/tasks` + Inbox quick capture | `tasks` (title required, rest nullable); RLS | Task created with title only |
| TASK-02 | Link task to goal/project/milestone; no cross-ownership links | P0 | Task create/edit | `tasks.goal_id`, `tasks.project_id`, `tasks.milestone_id`; RLS + ownership check | Cannot link to another user's project |
| TASK-03 | Subtasks with limited depth; no unchecked nesting | P0 | Task detail | `tasks.parent_task_id` (self-ref, depth limited); RLS | Subtask created under parent; depth capped |
| TASK-04 | Task states: Inbox, To Do, In Progress, Done, Cancelled | P0 | Task status selector | `tasks.status` CHECK; RLS | All states storable |
| TASK-05 | Time estimate in minutes (optional) | P0 | Task create/edit | `tasks.estimate_minutes` | Estimate saved; not required |
| TASK-06 | Due date vs scheduled date separation; undated tasks allowed | P0 | Task create/edit | `tasks.due_at` (timestamptz), `tasks.scheduled_for` (date); RLS | Undated task valid; due and scheduled are separate |
| TASK-07 | Up to three top priorities in Today; other tasks allowed | P0 | `/app/today` | `tasks.is_top_priority` + count limit per day per user | Max 3 top priorities enforced |
| TASK-08 | Conscious rescheduling: no auto-rollover of incomplete tasks | P0 | Today / task detail | `tasks.scheduled_for` updated by user action only | Incomplete tasks stay as-is; user chooses reschedule/cancel/return to Inbox |
| TASK-09 | Search + filter by status/goal/project/date (P1) | P1 | `/app/tasks` | Indexed queries on `tasks` | Filters return correct subset |
| TASK-10 | Order tasks via buttons or drag-drop with keyboard alternative | P0 | Task lists | `tasks.sort_order`; RLS | Reorder works via buttons and keyboard |

---

## 9.8 Schedule & Daily Plan

| PRD ID | Requirement | Pri | UI Route / Component | Database Entity / RLS Policy | Test Case |
|--------|-------------|-----|----------------------|------------------------------|-----------|
| PLAN-01 | Today plan shows top tasks, commitments, scheduled blocks | P0 | `/app/today` | `tasks`, `schedule_blocks` joined; RLS | Today page renders correct aggregates |
| PLAN-02 | Time blocks: Focus, Rest, Personal, Commitment | P0 | `/app/today` + schedule editor | `schedule_blocks` (block_type, start, end, owner_id); RLS | All block types creatable |
| PLAN-03 | Warn on overlapping blocks; allow override confirmation | P0 | Schedule editor | Application-level overlap check | Overlap warning shown; override allowed |
| PLAN-04 | Edit plan: move blocks, change duration, delete without losing actual session records | P0 | Schedule editor | `schedule_blocks` editable; `focus_sessions` immutable history | Deleting block doesn't delete completed sessions |
| PLAN-05 | Weekly view of blocks and tasks (P1) | P1 | `/app/today` weekly tab | `schedule_blocks` range query | Weekly view loads blocks for 7 days |

---

## 9.9 Focus Mode & Sessions

| PRD ID | Requirement | Pri | UI Route / Component | Database Entity / RLS Policy | Test Case |
|--------|-------------|-----|----------------------|------------------------------|-----------|
| TIMER-01 | Start session for a task from task or Focus Mode | P0 | `/app/focus` + task row | `focus_sessions` (task_id, owner_id, started_at); RLS | Session started linked to task |
| TIMER-02 | Configurable timer with default duration | P0 | Focus Mode client component | `focus_sessions.planned_seconds` | Default and custom durations work |
| TIMER-03 | Pause/resume saving elapsed times | P0 | Focus Mode | `focus_sessions` pause/resume timestamps | Paused time not counted; resume continues |
| TIMER-04 | Optional interruption counter + short note | P0 | Focus Mode | `focus_sessions.interruptions`, `focus_sessions.notes` | Interruptions incremented; note saved |
| TIMER-05 | Accurate after page reload: based on stored timestamps, not JS counter only | P0 | Focus Mode recovery | `focus_sessions.started_at`, `paused_at`, `resumed_at`; computed on server | Reload mid-session resumes correctly from stored timestamps |
| TIMER-06 | End session: save actual duration, status, linked task | P0 | Focus Mode end | `focus_sessions.ended_at`, `actual_seconds`, `status` | Completed session persisted with correct duration |
| TIMER-07 | No actual site blocking; UI states this | P0 | Focus Mode | (no DB) | UI disclaimer visible |
| TIMER-08 | Session log reviewable by day/task/goal | P0 | `/app/focus` history + insights | `focus_sessions` queries; RLS | Sessions filterable by day/task/goal |

---

## 9.10 Journal & Reviews

| PRD ID | Requirement | Pri | UI Route / Component | Database Entity / RLS Policy | Test Case |
|--------|-------------|-----|----------------------|------------------------------|-----------|
| JOUR-01 | Daily Review: short optional questions (achievement, blocker, next step) | P0 | `/app/journal` | `daily_reviews` (date, fields, owner_id); RLS | Daily review saved for a date; optional fields |
| JOUR-02 | Gratitude field: optional, private, excluded from analytics | P0 | `/app/journal` | `daily_reviews.gratitude` (not sent to analytics) | Gratitude saved; excluded from analytics events |
| JOUR-03 | Energy level: optional 1–5, not medical | P0 | `/app/journal` | `daily_reviews.energy_level` CHECK 1–5 | Energy 1–5 accepted; out-of-range rejected |
| REV-01 | Weekly Review: summarize achievements, blockers, open tasks, adjust focus | P0 | `/app/reviews` | `weekly_reviews` (week_start, summary, owner_id); RLS | Weekly review saved; linked to correct week |
| REV-02 | Cycle Review: document outcome and what to keep/change | P0 | `/app/focus-cycle` close | `focus_cycles.outcome`, `focus_cycles.notes` | Cycle review saved with outcome |
| REV-03 | Return-after-break: neutral resume UI, no blame language | P0 | On return / today | `focus_cycles`, `tasks` open | No streaks/shame language on return |

---

## 9.11 Insights & Analytics

| PRD ID | Requirement | Pri | UI Route / Component | Database Entity / RLS Policy | Test Case |
|--------|-------------|-----|----------------------|------------------------------|-----------|
| INS-01 | Weekly summary: completed tasks, focus sessions, documented progress | P0 | `/app/insights` | Aggregates over `tasks`, `focus_sessions`, `weekly_reviews` | Summary matches actual records |
| INS-02 | Goal progress: status, milestones, manual metric | P0 | `/app/insights` + goal detail | `goals.progress`, `milestones`, `tasks` | Progress reflects manual updates + task completion |
| INS-03 | Planned vs actual time (P1): based on available data, not presented as fact | P1 | `/app/insights` | `schedule_blocks.planned_seconds` vs `focus_sessions.actual_seconds` | Comparison labeled as estimate |
| INS-04 | Monthly trends (P1): user vs self across periods | P1 | `/app/insights` | Time-range aggregates | Trends computed per user only |
| INS-05 | Time distribution by life area (P1): only with sufficient reliable data | P1 | `/app/insights` | Joins tasks/sessions → goals → life areas | Distribution shown only when data sufficient |

---

## 9.12 Localization & Accessibility

| PRD ID | Requirement | Pri | UI Route / Component | Database Entity / RLS Policy | Test Case |
|--------|-------------|-----|----------------------|------------------------------|-----------|
| I18N-01 | Arabic + English; all core text translated; no scattered strings | P0 | All pages; i18n provider | `profiles.locale` | Locale switch changes all UI text |
| I18N-02 | RTL/LTR: alignment, direction, icons/spacing per language | P0 | Layout + all components | (CSS/RTL tokens) | Arabic page renders RTL; English LTR |
| I18N-03 | Dates/times per user timezone and week start | P0 | Date displays | `profiles.timezone`, `profiles.week_start` | Dates render in user's timezone |
| A11Y-01 | Keyboard navigation for all core actions | P0 | All interactive components | (semantic HTML) | Tab order works; no mouse required |
| A11Y-02 | Contrast and visible focus states | P0 | Design system | (CSS tokens) | WCAG AA contrast; focus visible |
| A11Y-03 | Drag-drop alternatives via buttons/keyboard | P0 | Reorderable lists | (components) | Keyboard reorder works |
| A11Y-04 | Screen reader labels, landmarks, state labels | P0 | All components | (ARIA attributes) | Screen reader announces states |

---

## Section 10 Core Business Rules (enforced at DB + domain)

| Rule | Enforcement | DB / Domain Location | Test |
|------|-------------|----------------------|------|
| One active Focus Cycle per user | Partial unique index | `focus_cycles` WHERE active | Duplicate active cycle rejected |
| One Primary Goal per cycle | Partial unique index | `focus_cycle_goals` role=primary | Two primaries rejected |
| Max two Secondary Goals | CHECK constraint / domain validation | `focus_cycle_goals` role=secondary | Third secondary rejected/warned |
| No auto-reschedule of incomplete tasks | Domain logic (never auto-update scheduled_for) | `tasks` | Tasks stay put overnight |
| Rest is valid, not failure | No streak/shame fields | (no streaks table) | No streak fields exist |
| Timestamps stored UTC; rendered in user TZ | `timestamptz` + application render | All `*_at` columns | UTC storage verified |
| Ownership verified on server + RLS | RLS policies `auth.uid() = owner_id` | Every user-owned table | Cross-account read/write rejected |
| No journal text to analytics | Analytics event allowlist | (application rule) | Journal fields absent from events |
| Archive by default for entities with history | `archived_at` boolean/timestamp | life_areas, goals, projects, focus_cycles | Archived records excluded from active views |

---

## Traceability Coverage Note

All P0 requirements from PRD sections 9.1–9.12 and Section 10 are mapped above. P1 items (GOAL-05, TASK-09, PLAN-05, INS-03/04/05, GOAL-05) are marked and scheduled post-MVP per PRD scope boundaries. P2/future items (AI, billing, integrations, collaboration) are explicitly out of MVP scope per PRD §6.3–6.4 and §8.