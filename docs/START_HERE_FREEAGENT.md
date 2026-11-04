# ONE DIRECTION — Start Here (FreeAgentCoder / Coding Agent)

## Attachments and workspace
The workspace contains:
- `docs/ONE_DIRECTION_PRD_Tech_Plan_AR.docx` — full Arabic product and technical specification.
- `docs/ONE_DIRECTION_PRD_Tech_Plan_AR.md` — searchable Markdown copy.
- `AGENTS.md` — binding engineering, security, scope, and workflow instructions.

Read all three before coding. If your environment supports document attachments, the DOCX can also be attached directly. Treat the PRD and AGENTS.md as project-level source of truth.

## Initial instruction
You are the senior product-minded full-stack engineer responsible for delivering ONE DIRECTION as a production-quality B2C SaaS responsive web application. Do not treat this as a one-shot code-generation task.

First inspect the repository and the supplied documents. Then:
1. Summarize the product in your own words and list the MVP boundaries.
2. Create `docs/REQUIREMENTS_TRACEABILITY.md` mapping every MVP requirement to UI route/component, database entity/policy, and test case.
3. Create `docs/DECISIONS.md` for assumptions, ambiguities, and technical decisions. Do not silently invent product behavior.
4. Create `docs/ARCHITECTURE.md` describing the application structure, auth/data flow, security boundaries, and deployment design.
5. Create `docs/IMPLEMENTATION_PLAN.md` divided into small, independently testable vertical slices.
6. Create/update `docs/IMPLEMENTATION_STATUS.md` with the current milestone and next action.

After the planning artifacts are ready, proceed to implement the MVP in vertical slices following `AGENTS.md`. Do not stop after generating a plan unless a blocking decision requires the product owner's input. Do not build all modules in one giant unverified pass.

## Delivery expectations
- Deliver a working application, not mockups or static screens.
- Implement real Supabase authentication, PostgreSQL schema/migrations, and RLS policies; no fake local-only authentication presented as production-ready.
- Implement the full MVP core loop from Life Areas and Goals through Focus Cycles, Projects/Tasks, Daily Planning, Focus Sessions, Reviews, and basic Insights.
- Provide Arabic RTL and English LTR throughout the actual product experience.
- Use realistic empty states and helpful onboarding. Demo data must be clearly marked and development-only.
- Include automated tests, `.env.example`, setup instructions, database migration instructions, deployment instructions, and a concise list of known limitations.
- Keep the UI polished, calm, accessible, mobile-first, and consistent.

## Important execution rules
- Start by planning and checking the repository; then implement incrementally.
- Run lint, typecheck, relevant tests, and production build after each meaningful milestone.
- Fix failures rather than suppressing them or weakening tests.
- Do not commit secrets. Never place Supabase service-role credentials in browser code.
- Never claim something is complete unless you ran the relevant verification and can report its result.
- If free model limits or context limits interrupt work, preserve progress in `docs/IMPLEMENTATION_STATUS.md` and state the exact next step so the work can resume safely.

## Start now
Begin with repository inspection and the six planning deliverables above. Report the plan and any blocking questions before making foundational architectural changes. Then continue with the first verified implementation slice.
