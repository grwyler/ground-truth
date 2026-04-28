# Done Log

## 2026-04-28 - MVP-004

- Added project intake domain validation and project creation helpers that initialize new projects as Draft and Not Ready.
- Added an in-memory project repository for MVP project list/read/create behavior and project creation audit records.
- Added `GET /api/v1/projects`, `GET /api/v1/projects/{projectId}`, and `POST /api/v1/projects` with local session authorization.
- Reworked the static web shell into a project intake page with PM-only creation controls, project inventory, and workspace status summary.
- Added unit/API coverage for project validation, authorization, persistence, audit creation, project listing, and project readback.
- Verified with `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.

## 2026-04-28 - MVP-003

- Added the MVP baseline PostgreSQL migration for projects, documents, AI generation jobs, decision objects and versions, trace links, approvals, readiness evaluations, blockers, overrides, certification packages, Jira exports, users, role assignments, and audit events.
- Added schema metadata helpers for table discovery and required-field validation.
- Added deterministic MVP seed data for a realistic Not Ready project with documents, draft/generated decision objects, versions, traceability, approvals, blockers, an override, package/export records, users, roles, and audit events.
- Added `npm run db:seed` to reset and write local seed data under `.data/seed`.
- Added unit tests proving required schema collections, mandatory fields, seed relationships, immutable version approval references, and override-to-blocker references.
- Verified with `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run db:seed`.

## 2026-04-28 - MVP-002

- Added seeded local/dev users for Program Manager, Engineering Lead, Operator Representative, Customer PM, and Executive Viewer.
- Added an AI Assistant/System actor that can generate drafts but cannot approve, reject, request changes, override, or export.
- Centralized MVP role constants, permission constants, and authorization helpers in the domain package.
- Added a local auth session boundary for the API and a role-aware session helper for the web shell.
- Updated the test command to use a repo-local test loader that works in the Windows sandbox.
- Verified with `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.

## 2026-04-28 - MVP-001

- Established the dependency-free Node.js application scaffold.
- Added repo boundaries for web UI, API/server logic, shared domain modules, persistence, scripts, and tests.
- Added local quality gates for lint, typecheck, unit tests, and build.
- Documented the MVP stack and local workflow in `README.md`.
- Added `.env.example` for database, storage, AI, auth, and Jira configuration placeholders.
- Verified with `npm install`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.
