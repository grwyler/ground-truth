# Ground Truth

Ground Truth is the MVP implementation workspace for a Pre-Development Readiness Platform. The MVP stack is intentionally small at this stage: dependency-free Node.js modules, a static web app boundary, an HTTP API boundary, shared domain modules, a persistence adapter boundary, and Node's built-in test runner.

## Repository Layout

- `apps/web` - browser UI shell and future route/components.
- `apps/api` - API/server entry point and future route handlers.
- `packages/domain` - shared product/domain types and business rules.
- `packages/db` - persistence configuration, repositories, migrations, and seed hooks.
- `tests` - unit and future integration/e2e tests.
- `scripts` - local quality gate and build scripts.
- `docs/codex` - implementation backlog, execution notes, and completion log.

## Local Workflow

Install dependencies:

```bash
npm install
```

Start the MVP locally:

```bash
npm run dev
```

The unified dev server runs the API and web UI on `http://localhost:4000`.

Run the quality gates:

```bash
npm run lint
npm run typecheck
npm test
npm run smoke:mvp
npm run build
```

Reset and write deterministic MVP seed data:

```bash
npm run db:seed
```

Run the API only, if you need to exercise backend routes without the UI:

```bash
npm run dev:api
```

The API listens on `API_PORT` or `4000` and exposes `GET /health`.

Run the browser-local web module directly for unit-style shell checks:

```bash
npm run dev:web
```

The web script prints a local hint when run from Node. For actual preview, use `npm run dev`.

Run the MVP pilot smoke flow:

```bash
npm run smoke:mvp
```

The smoke flow resets deterministic seed data, runs the Ready-to-Build happy path, runs the PM override path, verifies certification package generation, and verifies Jira export gating/preview behavior.

## Running the MVP Locally

1. Install dependencies with `npm install`.
2. Start the app with `npm run dev`.
3. Open `http://localhost:4000` for the UI.
4. Open `http://localhost:4000/health` to verify the API.
5. Use `x-user-id` request headers such as `user-pm-001`, `user-eng-001`, `user-operator-001`, `user-customer-pm-001`, or `user-exec-viewer-001` when exercising API routes locally.

The unified dev server serves browser modules from `apps/web/src` and shared package modules from `packages`, so no `file://` paths or repo-root static serving are required. The repeatable pilot flow is documented in `docs/codex/mvp-demo-flow.md`.

## Environment

Copy `.env.example` to `.env.local` for local development. The example documents expected configuration for database access, storage, AI provider, auth, and Jira integration without including real secrets.

## MVP Stack

- Runtime: Node.js 20+ with ES modules.
- Web UI: static browser modules in `apps/web` until a framework is justified by feature work.
- API: Node's built-in `http` module behind route functions in `apps/api`.
- Domain: plain JavaScript modules with JSDoc-friendly exports in `packages/domain`.
- Persistence: adapter boundary in `packages/db` with the MVP-003 schema migration and deterministic seed data.
- Tests: Node's built-in `node:test`.

Future tickets can swap in richer framework pieces while preserving these repo boundaries.
