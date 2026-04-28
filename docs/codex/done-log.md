# Done Log

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
