# Done Log

## 2026-04-28 - MVP-010

- Added traceability domain helpers for MVP relationship validation, mandatory readiness-link detection, trace link summaries, and create/delete audit event details.
- Extended the in-memory repository with active trace link list/create/delete/read behavior while preserving link removals in the audit stream.
- Added `GET`, `POST`, and `DELETE` support under `/api/v1/projects/{projectId}/decision-objects/{objectId}/links` with project read/edit authorization.
- Added a focused browser-local traceability panel for requirement objects showing missing workflow/test links, active links, add controls, and remove actions.
- Added unit/API coverage for requirement-to-workflow links, requirement-to-test links, invalid relationship rejection, unsupported relationship rejection, unauthorized API writes, deletion, audit records, and local workspace persistence.
- Verified with `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.

## 2026-04-28 - MVP-009

- Added ownership assignment domain helpers for validating project-assigned owners, restricting owner changes to Draft/In Review objects, and producing owner-change audit details.
- Extended the in-memory repository with users, role assignments, assignable owner lookup, and owner assignment persistence.
- Added `PATCH /api/v1/projects/{projectId}/decision-objects/{objectId}/owner` for PM-controlled ownership changes and blocked non-PM ownership reassignment through the generic object update path.
- Added browser-local owner selectors, owner display text, and explicit missing-owner prompts in the draft review workspace.
- Added unit/API coverage for owner validation, audit details, successful assignment, unauthorized reassignment, and version preservation.
- Verified with `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`.

## 2026-04-28 - MVP-008

- Added decision object creation and versioned update domain helpers, including meaningful-change detection and change-reason enforcement when prior approvals exist.
- Added immutable version creation for content edits while keeping owner/status/priority-only edits from creating unnecessary versions.
- Added decision object API support for creating objects, reading a single object, updating objects, and listing version history.
- Extended the in-memory repository with approval-aware versioning persistence and retrievable version history.
- Added a small browser-local decision object create flow plus change-reason capture and version badge continuity in the existing workspace editor.
- Added unit/API coverage for object creation, content-change version increments, metadata-only updates, prior-version preservation, approval-backed change reason validation, and version history retrieval.
- Verified with `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`.

## 2026-04-28 - MVP-007

- Added draft review domain helpers for editing generated draft content, accepting drafts into the active Draft set, rejecting drafts, and marking rejected drafts as excluded from readiness.
- Added decision object API routes for listing project decision objects, editing draft content, accepting drafts, and rejecting drafts with role-based authorization and audit events.
- Extended the in-memory project repository with decision object lookup and draft update persistence.
- Reworked the web AI draft area into a document-like review workspace with grouped Workflows, Requirements, Tests, and Risks; editable content; version/source/status/owner details; and Accept/Reject controls.
- Added unit/API coverage for draft edit, accept, reject, readiness exclusion, audit creation, and unauthorized edit protection.
- Verified with `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`.

## 2026-04-28 - MVP-006

- Added a deterministic AI draft adapter boundary that converts uploaded documents into draft Workflow, Requirement, Test, and Risk candidates.
- Added AI generation job lifecycle helpers for Queued, Running, Completed, and Failed states with source document IDs and `mvp-draft-v1` schema metadata.
- Added in-memory persistence for AI generation jobs, draft decision objects, immutable draft versions, and AI generation audit events.
- Added `POST /api/v1/projects/{projectId}/ai/generate-draft` and `GET /api/v1/projects/{projectId}/ai/generation-jobs/{generationJobId}` with PM generation authorization and readable failure state.
- Added project workspace AI draft generation UI with disabled pre-upload state, generation status, and grouped draft object display.
- Added unit/API coverage for draft normalization, job state transitions, successful generation, failed generation, missing documents, authorization, and local UI service behavior.
- Verified with `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.

## 2026-04-28 - MVP-005

- Added document upload validation for PDF, DOCX, and TXT files with deterministic checksums and document upload audit events.
- Added local filesystem storage behind a storage adapter and in-memory document inventory persistence.
- Added `GET /api/v1/projects/{projectId}/documents` and `POST /api/v1/projects/{projectId}/documents` with PM-only upload authorization.
- Added project workspace document inventory UI, multi-file upload controls, inline failures, and disabled AI draft generation until documents exist.
- Added unit/API coverage for file type validation, checksum generation, multi-file upload, unsupported file rejection, unauthorized upload, persistent inventory, and local UI service behavior.
- Verified with `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.

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
