# ONE DIRECTION — Agent Engineering Instructions

## 1. Product identity
- Product: ONE DIRECTION, a B2C SaaS Personal Life Operating System.
- Audience: individual users. Each account owns a private personal workspace.
- Platform: responsive web application for mobile, tablet, and desktop.
- Product promise: help users see what matters now, choose a clear priority, turn goals into practical next steps, and make sustainable progress without guilt-based productivity mechanics.
- The Arabic PRD in `docs/ONE_DIRECTION_PRD_Tech_Plan_AR.docx` is the primary product specification. The Markdown version beside it is searchable text. Read both before implementation; when they differ, flag the conflict and use the more explicit requirement only after documenting the decision.

## 2. Non-negotiable product principles
1. Users may keep many long-term goals, but only a limited subset should be active at once.
2. One active Focus Cycle per user; exactly one Primary Goal; up to two Secondary Goals in the MVP.
3. Goals that are planned, on hold, or in maintenance must not be treated as daily commitments.
4. Rest is a valid planned activity, not a failure state.
5. Measure progress against the user's own history, never through public rankings.
6. Do not add punitive streaks, shame-based reminders, productivity scores, or competitive leaderboards.
7. Journal entries, reflections, and personal goal details are private by default.
8. Do not silently change a user's priorities or schedule. Recommendations must be reviewable and user-approved.

## 3. Approved initial technology direction
Use this direction unless the PRD or a verified compatibility issue requires a documented change:
- Next.js App Router + React + TypeScript.
- Tailwind CSS and accessible reusable UI primitives (shadcn/ui where suitable).
- Supabase: PostgreSQL, Auth, and Row Level Security.
- Zod for runtime validation; React Hook Form for complex forms.
- Recharts for basic analytics only where meaningful.
- Vitest + React Testing Library for unit/component tests; Playwright for critical end-to-end journeys.
- Vercel deployment target; Supabase hosted backend.

Before adding a dependency, verify that it is maintained, compatible with the installed framework version, and actually needed. Pin versions through the package manager lockfile. Do not upgrade major dependencies opportunistically.

## 4. Architecture and code quality
- Prefer Server Components for read-only server-rendered UI. Use Client Components only for browser interaction, local state, timers, and other interactive behavior.
- Keep domain logic out of presentation components. Separate UI, domain/services, data access, validation schemas, and shared types.
- Use strict TypeScript. Do not use `any` to bypass a typing problem; use explicit types and safe narrowing.
- Validate all external input on the server, even when client validation exists.
- Handle loading, empty, error, success, and destructive-action states intentionally.
- Use semantic HTML, keyboard-accessible controls, visible focus states, adequate contrast, and accessible labels.
- Build a coherent design system: spacing, typography, color tokens, surfaces, buttons, forms, navigation, dialogs, toasts, and responsive breakpoints.
- Do not create a generic admin-dashboard look. The product should feel calm, focused, clear, and supportive.
- Avoid overengineering, premature abstractions, unnecessary global state, and duplicate data fetching.

## 5. Internationalization and responsive behavior
- Support Arabic and English from the beginning, not as a final retrofit.
- Arabic must use correct RTL layout and directional icons/alignment where appropriate; English must use LTR.
- Persist the user's language preference and respect locale-aware date, number, and time formatting.
- Store timestamps consistently (UTC in the database) and render them using the user's configured IANA timezone.
- Design mobile-first and verify common narrow phone widths, tablet, laptop, and large desktop layouts.
- Never hardcode layout assumptions that break in RTL or at narrow widths.

## 6. Security and privacy — release blockers
- Every user-owned database row must be protected by PostgreSQL RLS. Do not rely only on hiding UI or filtering queries in the frontend.
- Test cross-account isolation for every user-owned table and every storage bucket/policy if storage is introduced.
- Use the Supabase publishable/anon key only in the browser as intended. Never expose the service-role key or other secrets to client bundles, source control, logs, screenshots, or documentation.
- Keep secrets in local environment variables / deployment secret storage. Provide `.env.example` with placeholders only.
- Verify ownership on server mutations and prevent insecure direct-object reference access.
- Do not send journal text, reflection text, goal descriptions, or other private content to analytics.
- Do not add AI processing, payment collection, advertising trackers, or third-party calendar integrations in the MVP unless the product owner explicitly approves the scope change.
- Implement export and account deletion according to the PRD, including dependent records and clear confirmation.

## 7. Data integrity
- Use SQL migrations committed to the repository. Do not rely on undocumented manual dashboard edits.
- Add constraints, indexes, foreign keys, and safe delete behavior intentionally.
- Enforce one active Focus Cycle per user at database level where feasible (e.g. partial unique index), not only in UI code.
- Enforce one Primary Goal per cycle and the Secondary Goal limit in validated domain logic and, where practical, database constraints/triggers.
- Prevent orphaned records and define what happens when a goal, project, milestone, or task is archived/deleted.
- Keep a clear audit/history strategy for status changes and completed reviews where required by the PRD.

## 8. Product scope boundaries for MVP
Build the core loop first:
Life Areas → Goals → Focus Cycle → Projects/Milestones/Tasks → Daily Plan → Focus Sessions/Rest → Daily Review → Weekly Review → Basic Insights.

Do NOT implement in MVP unless explicitly approved:
- AI assistant or automatic AI scheduling.
- Billing/subscriptions/payment gateway.
- Team workspaces or collaboration.
- Public profiles, social feed, rankings, or gamification.
- Browser extension or app/site blocking.
- External calendar integrations.
- Native mobile applications.

Keep architecture extensible, but do not build these features preemptively.

## 9. Required agent workflow
1. Inspect the existing repository before making changes. Preserve working code and conventions where sensible.
2. Read the complete PRD and this file. Produce a traceability matrix mapping every MVP requirement to a planned module, route, database object, and test.
3. Identify ambiguities, contradictions, missing acceptance criteria, and technical risks. Make a `docs/DECISIONS.md`; do not invent product rules silently.
4. Produce an implementation plan divided into small vertical slices. Each slice must end in a runnable, testable state.
5. Implement one slice at a time. After each slice, run relevant lint, typecheck, tests, and build; inspect the diff; fix regressions before continuing.
6. Keep `docs/IMPLEMENTATION_STATUS.md` current with completed work, current phase, known issues, and exact next step.
7. Use Git commits after each verified milestone if Git is initialized. Never rewrite or delete user changes. Do not force-push.
8. If a task is too large for one context window, leave a precise handoff in `docs/IMPLEMENTATION_STATUS.md` and continue from it in the next session.
9. Ask the product owner only when blocked by a consequential product, legal, payment, privacy, or destructive decision. Otherwise make the safest reversible assumption and document it.
10. Never claim a feature is complete unless it runs and its relevant tests pass. Report any unverified behavior explicitly.

## 10. Definition of done for every feature
- Matches the PRD and has traceable acceptance criteria.
- Works in Arabic RTL and English LTR where applicable.
- Works on mobile and desktop.
- Includes loading, empty, error, success, and validation states as relevant.
- Validates input on the server.
- Enforces authorization and ownership at the data layer.
- Includes appropriate automated tests.
- No new TypeScript, lint, or build errors.
- No secrets, private user content, placeholder text, fake production data, or unfinished TODOs shipped accidentally.
- Documentation and implementation status are updated.

## 11. Final release gate
Before declaring MVP release-ready:
- Run formatter, lint, typecheck, unit/component tests, integration tests, and Playwright critical-path tests.
- Run a clean production build.
- Verify sign-up, sign-in, sign-out, password reset, onboarding, goal creation, Focus Cycle rules, project/task flow, timer recovery, daily review, weekly review, export, and account deletion.
- Test two separate accounts and prove that neither can read or mutate the other's records through UI or direct API/database requests.
- Test Arabic RTL and English LTR at mobile, tablet, and desktop widths.
- Check accessibility basics and keyboard navigation.
- Provide deployment instructions, required environment variables, migration instructions, seed/demo instructions (development only), and known limitations.
