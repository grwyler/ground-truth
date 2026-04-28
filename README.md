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

Run the quality gates:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Reset and write deterministic MVP seed data:

```bash
npm run db:seed
```

Run the placeholder API:

```bash
npm run dev:api
```

The API listens on `API_PORT` or `4000` and exposes `GET /health`.

Run the placeholder web shell:

```bash
npm run dev:web
```

The web script renders a static shell when loaded in a browser and prints a local file hint when run from Node.

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
