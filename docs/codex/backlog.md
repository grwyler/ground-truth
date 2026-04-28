# MVP Implementation Backlog

This backlog covers the MVP only: project intake, document upload, AI draft generation, editable decision objects, mandatory traceability, approval/versioning, basic diff, readiness computation, dashboard visibility, override governance, certification preview, and Jira export gating.

Out of scope for MVP: advanced traceability graph visualization, custom readiness rule builders, external customer portal, GovCloud/IL5/IL6 deployment hardening, bidirectional Jira sync, AI validation/intelligence features, advanced risk prediction, and role customization beyond the MVP roles.

Source notes: `docs/OPERATOR_WORKLFOW.md` is currently empty, so operator workflow assumptions are taken from `docs/UX_DESIGN.md`, `docs/FUNCTIONAL_REQUIREMENTS.md`, and `docs/ROLES_AND_PERMISSIONS.md`.

## MVP-001 - Establish Application Scaffold And Quality Gates

**Ticket ID:** MVP-001

**Status:** Complete.

**Title:** Establish application scaffold and quality gates

**Goal:** Create the minimal app structure, local developer workflow, and automated checks needed for subsequent tickets.

**User story:** As a developer, I need a predictable project scaffold so I can implement the readiness platform in small, testable increments.

**Implementation notes:**
- Choose and document the MVP stack in repo-local config before feature work starts.
- Create separate boundaries for web UI, API/server logic, shared domain types, persistence, and tests.
- Add baseline lint, typecheck, unit test, and build commands.
- Add environment variable examples for database, storage, AI provider, auth, and Jira integration.
- Keep the scaffold minimal; do not implement product features in this ticket.

**Files likely to change:**
- `package.json`
- `README.md`
- `.env.example`
- `apps/web/**`
- `apps/api/**`
- `packages/domain/**`
- `packages/db/**`
- `tests/**`

**Data model impact:** None beyond establishing the location for future schema and migration files.

**UI impact:** Empty app shell or placeholder route only.

**Acceptance criteria:**
- A new developer can install dependencies and run the app locally.
- `lint`, `typecheck`, `test`, and `build` commands exist and run successfully.
- The repo has clear directories for UI, API, domain logic, persistence, and tests.
- Required local environment variables are documented without real secrets.

**Test requirements:**
- Baseline unit test passes.
- Build command succeeds in a clean checkout.
- CI-ready command list is documented.

**Definition of done:**
- Scaffold is committed-ready.
- No product behavior is mixed into the scaffold.
- Future tickets can name concrete files and modules from this structure.

**Dependencies:** None.

## MVP-002 - Add Authentication Stub And MVP Role Model

**Ticket ID:** MVP-002

**Status:** Complete.

**Title:** Add authentication stub and MVP role model

**Goal:** Provide enough identity and authorization structure to enforce PM, Engineering Lead, Operator Representative, Customer PM, and Executive Viewer behavior.

**User story:** As a platform user, I need the system to know who I am and what role I hold so approvals, overrides, and dashboard permissions are accountable.

**Implementation notes:**
- Implement a local/dev auth adapter that returns seeded users and roles.
- Add server-side authorization helpers for project read, project edit, approval, override, and export permissions.
- Model AI Assistant/System as a non-human actor that cannot approve or override.
- Keep enterprise SSO/OIDC integration out of MVP implementation; design the adapter boundary so it can be replaced later.

**Files likely to change:**
- `packages/domain/auth.ts`
- `packages/domain/roles.ts`
- `apps/api/auth/**`
- `apps/web/lib/session/**`
- `tests/unit/auth/**`

**Data model impact:** Introduces MVP `User` and `RoleAssignment` concepts, either as persisted tables or seeded records depending on the persistence layer chosen in MVP-003.

**UI impact:** Role-aware navigation and action visibility can be driven from the current user, but full login UI is not required yet.

**Acceptance criteria:**
- Seeded MVP users exist for PM, Engineering Lead, Operator Representative, Customer PM, and Executive Viewer.
- Authorization helpers deny approval, override, and export actions for unauthorized roles.
- PM can perform project management actions and submit overrides.
- Executive Viewer can view readiness but cannot edit objects, approve, override, or export.
- AI/System actor cannot approve, reject, request changes, or override.

**Test requirements:**
- Unit tests cover allow/deny cases for each MVP role.
- Unit tests prove AI/System actor cannot perform human decision actions.

**Definition of done:**
- Role checks are centralized and reusable.
- Product code has no ad hoc role string comparisons outside the authorization module.
- Tests document the MVP permission matrix.

**Dependencies:** MVP-001.

## MVP-003 - Create MVP Database Schema And Seed Data

**Ticket ID:** MVP-003

**Status:** Complete.

**Title:** Create MVP database schema and seed data

**Goal:** Implement the decision-object-centric persistence model needed for the MVP readiness flow.

**User story:** As the platform, I need durable project, document, decision, approval, blocker, override, and export records so readiness decisions are traceable and reproducible.

**Implementation notes:**
- Add migrations for MVP entities: `Project`, `Document`, `AIGenerationJob`, `DecisionObject`, `DecisionObjectVersion`, `TraceLink`, `Approval`, `ReadinessEvaluation`, `Blocker`, `Override`, `CertificationPackage`, `JiraExport`, `User`, `RoleAssignment`, and `AuditEvent`.
- Limit object types to Workflow, Requirement, Test/Acceptance Criteria, and Risk for MVP.
- Include timestamps, project scoping, owner references, status enums, version identifiers, and audit/event references where needed.
- Add deterministic seed data for one realistic project matching the clickable concept: workflows, requirements, missing acceptance criteria, pending approvals, blockers, and roles.

**Files likely to change:**
- `packages/db/schema/**`
- `packages/db/migrations/**`
- `packages/db/seed/**`
- `packages/domain/models/**`
- `tests/unit/db/**`

**Data model impact:** Establishes the MVP data model and migration baseline.

**UI impact:** Enables future UI tickets to render real seeded data instead of hardcoded mock objects.

**Acceptance criteria:**
- Migrations create all MVP tables or equivalent persisted collections.
- Seed script creates at least one project with documents, decision objects, versions, links, approvals, blockers, users, and role assignments.
- Requirement objects can be related to Workflow and Test objects through trace links.
- Approvals reference immutable decision object versions.
- Overrides can reference one or more blockers.

**Test requirements:**
- Migration smoke test passes against a local database.
- Seed data test verifies required records and relationships exist.
- Schema tests enforce mandatory fields for project, decision object, version, trace link, approval, blocker, and override records.

**Definition of done:**
- Database can be reset and seeded from a documented command.
- Seed data supports the full MVP happy path.
- Schema reflects MVP scope without phase-two entities that are not needed yet.

**Dependencies:** MVP-001, MVP-002.

## MVP-004 - Implement Project Intake API And Project Shell UI

**Ticket ID:** MVP-004

**Status:** Complete.

**Title:** Implement project intake API and project shell UI

**Goal:** Allow a PM to create and view readiness projects.

**User story:** As a Program Manager, I need to create a project after contract award so readiness work can start in a governed project workspace.

**Implementation notes:**
- Implement `POST /api/v1/projects` and basic project read/list endpoints needed by the UI.
- Validate required project name and initialize projects in Draft/Not Ready state.
- Audit project creation.
- Build a project list or landing route plus project workspace shell.
- Show project name, status, readiness status, and readiness score placeholder.

**Files likely to change:**
- `apps/api/routes/projects/**`
- `packages/domain/projects/**`
- `packages/db/repositories/projects.ts`
- `apps/web/routes/projects/**`
- `apps/web/components/project/**`
- `tests/unit/projects/**`
- `tests/e2e/project-intake.spec.*`

**Data model impact:** Uses `Project`, `RoleAssignment`, and `AuditEvent`; no new entities expected.

**UI impact:** Adds project creation flow and project workspace shell.

**Acceptance criteria:**
- PM can create a project with required metadata.
- Missing project name returns a validation error.
- Created project appears in the project list immediately.
- New project starts as Draft and Not Ready.
- Project creation emits an audit event.
- Non-authorized users cannot create projects.

**Test requirements:**
- Unit tests for project validation and authorization.
- API tests for successful and failed project creation.
- E2E test for creating a project and landing in its workspace.

**Definition of done:**
- Project intake is usable end to end with seeded PM user.
- Errors are visible and actionable.
- Project shell can host future document, draft, approval, and readiness screens.

**Dependencies:** MVP-002, MVP-003.

## MVP-005 - Implement Document Upload And Document Inventory

**Ticket ID:** MVP-005

**Title:** Implement document upload and document inventory

**Goal:** Allow PMs to upload SOWs and supporting documents that become the source material for AI draft generation.

**User story:** As a Program Manager, I need to upload SOWs, proposals, PDFs, notes, and legacy documents so the platform can generate the first readiness draft.

**Implementation notes:**
- Implement `POST /api/v1/projects/{projectId}/documents`.
- Store file metadata, checksum, upload status, document type, uploader, and storage URI.
- For MVP, local filesystem or configured object storage is acceptable behind a storage adapter.
- Support at minimum PDF, DOCX, and TXT extensions, even if parsing is stubbed until MVP-006.
- Build intake UI with upload progress, uploaded document list, and inline per-document failure messages.

**Files likely to change:**
- `apps/api/routes/documents/**`
- `packages/domain/documents/**`
- `packages/db/repositories/documents.ts`
- `packages/storage/**`
- `apps/web/routes/projects/[projectId]/intake/**`
- `apps/web/components/documents/**`
- `tests/unit/documents/**`
- `tests/e2e/document-upload.spec.*`

**Data model impact:** Uses `Document` and `AuditEvent`; may add storage adapter metadata fields if not already present.

**UI impact:** Adds project intake page, drag/drop or file-picker upload, upload status list, and document empty/error states.

**Acceptance criteria:**
- Authorized PM can upload multiple supported documents.
- Unsupported file types are rejected with a clear error.
- Upload failures do not delete existing documents.
- Uploaded documents persist and reload in the document inventory.
- AI draft generation action is disabled until at least one document is uploaded.
- Uploads emit audit events.

**Test requirements:**
- Unit tests for file type validation and checksum generation.
- API tests for multi-file upload, unsupported type, and unauthorized upload.
- E2E test for uploading a TXT fixture and seeing it in the inventory.

**Definition of done:**
- Documents are durably represented and visible in the project.
- Storage implementation is hidden behind an adapter.
- Intake page is ready for AI generation workflow.

**Dependencies:** MVP-004.

## MVP-006 - Implement AI Draft Generation Adapter And Job Lifecycle

**Ticket ID:** MVP-006

**Title:** Implement AI draft generation adapter and job lifecycle

**Goal:** Convert uploaded documents into editable draft workflows, requirements, risks, and acceptance criteria candidates.

**User story:** As a PM, I need the system to generate a first draft from source documents so I can start from structured content instead of a blank page.

**Implementation notes:**
- Implement `POST /api/v1/projects/{projectId}/ai/generate-draft` and `GET /api/v1/projects/{projectId}/ai/generation-jobs/{generationJobId}`.
- Create an AI adapter boundary with a deterministic local/mock implementation for MVP tests.
- Track job status: Queued, Running, Completed, Failed.
- Normalize AI output into draft decision object payloads but do not mark them approved.
- Include source document references and AI schema version.
- Handle AI failure gracefully and allow manual continuation.

**Files likely to change:**
- `apps/api/routes/ai/**`
- `packages/domain/ai/**`
- `packages/domain/drafts/**`
- `packages/db/repositories/ai-generation-jobs.ts`
- `packages/ai/**`
- `apps/web/components/ai-generation/**`
- `tests/unit/ai/**`
- `tests/e2e/ai-generation.spec.*`

**Data model impact:** Uses `AIGenerationJob`, `Document`, `DecisionObject`, `DecisionObjectVersion`, and `AuditEvent`; may add draft metadata to version content.

**UI impact:** Adds AI generation action panel, progress stages, completed draft notification, and failure state with retry/manual continuation.

**Acceptance criteria:**
- PM can trigger AI generation after documents are uploaded.
- Job status can be polled or refreshed from the UI.
- Completed job produces draft Workflow, Requirement, Test, and Risk objects.
- Drafts are clearly labeled AI-generated and not authoritative.
- Failed job displays an actionable error and does not remove uploaded documents.
- AI/System actor is recorded as generator but not as owner, approver, or override authority.

**Test requirements:**
- Unit tests for output normalization and job state transitions.
- API tests for trigger, status retrieval, and failure response.
- E2E test for upload, generate draft, and seeing draft objects in the workspace.

**Definition of done:**
- MVP can demonstrate immediate value from source documents.
- AI integration remains replaceable through a single adapter boundary.
- AI failure does not block manual workflow.

**Dependencies:** MVP-005.

## MVP-007 - Build Draft Review Workspace

**Ticket ID:** MVP-007

**Title:** Build draft review workspace

**Goal:** Let users review, edit, accept, reject, and organize AI-generated draft objects in a document-like workspace.

**User story:** As a PM or assigned stakeholder, I need to review AI-generated drafts in context so human-owned decisions can replace untrusted draft output.

**Implementation notes:**
- Build the primary workspace with sections for Workflows, Requirements, Risks, and Missing Questions if present.
- Provide editable document-like content areas plus structured overlays for owner, status, version, source references, and required actions.
- Implement accept/reject behavior for draft suggestions.
- Accepted AI suggestions become decision objects or active versions in Draft status.
- Rejected suggestions remain excluded from readiness computation.
- Keep rich text/editor implementation minimal for MVP; plain structured content is acceptable if editing is fluid.

**Files likely to change:**
- `apps/web/routes/projects/[projectId]/workspace/**`
- `apps/web/components/workspace/**`
- `apps/web/components/decision-objects/**`
- `apps/api/routes/decision-objects/**`
- `packages/domain/decision-objects/**`
- `tests/e2e/draft-workspace.spec.*`

**Data model impact:** Uses `DecisionObject`, `DecisionObjectVersion`, `AuditEvent`, and AI draft metadata; no new entities expected.

**UI impact:** Adds document-first draft workspace, left navigation, main editor, right structured overlay, and AI suggestion controls.

**Acceptance criteria:**
- Users can view generated draft workflows, requirements, and risks grouped by type.
- AI-generated content is visually identified as Draft/Suggested.
- User can edit draft content and save changes.
- User can accept a draft into the active decision object set.
- User can reject a draft so it does not affect readiness.
- Accepted objects have owners or are flagged for ownership assignment.

**Test requirements:**
- Component tests for draft labels, section navigation, and overlay fields.
- API tests for accept/reject/update draft actions.
- E2E test for accepting a generated requirement and editing its content.

**Definition of done:**
- AI output is useful but clearly subordinate to human review.
- Draft workspace supports the PM-to-owner handoff.
- Accepted decision objects are ready for ownership and traceability work.

**Dependencies:** MVP-006.

## MVP-008 - Implement Decision Object Editing And Version Creation

**Ticket ID:** MVP-008

**Title:** Implement decision object editing and version creation

**Goal:** Support durable editing of Workflow, Requirement, Test, and Risk objects with immutable version history.

**User story:** As a Systems Engineer or Operator Representative, I need to edit workflows and requirements while preserving prior versions so approvals and diffs stay accountable.

**Implementation notes:**
- Implement create/update/read endpoints for decision objects.
- Meaningful content changes create a new `DecisionObjectVersion`.
- Preserve previous versions immutably.
- Require change reason for meaningful changes when the object already has approvals.
- Start with a conservative meaningful-change rule: content, acceptance criteria, or workflow logic changes are meaningful; owner/status display-only updates are not.
- Update object status to Draft or In Review as appropriate after meaningful changes.

**Files likely to change:**
- `apps/api/routes/decision-objects/**`
- `packages/domain/decision-objects/**`
- `packages/domain/versioning/**`
- `packages/db/repositories/decision-objects.ts`
- `apps/web/components/decision-objects/editor/**`
- `tests/unit/versioning/**`
- `tests/e2e/decision-object-editing.spec.*`

**Data model impact:** Uses and validates `DecisionObject` and `DecisionObjectVersion`; may add object schema version metadata.

**UI impact:** Adds requirement/workflow detail editor, version badge, save flow, and change reason prompt.

**Acceptance criteria:**
- Users can create and edit Workflow, Requirement, Test, and Risk objects.
- Content changes create a new immutable version.
- Non-content metadata changes do not create unnecessary versions.
- Current version number is visible in the UI.
- Prior versions remain retrievable.
- Unauthorized users cannot edit restricted objects.

**Test requirements:**
- Unit tests for meaningful vs non-meaningful change detection.
- API tests for object creation, update, version increment, and version retrieval.
- E2E test for editing a requirement and seeing the version number advance.

**Definition of done:**
- Versioning behavior is deterministic and tested.
- Editing flows preserve history.
- Later approval invalidation can hook into version creation.

**Dependencies:** MVP-007.

## MVP-009 - Implement Ownership Assignment

**Ticket ID:** MVP-009

**Title:** Implement ownership assignment

**Goal:** Ensure every decision object has a named accountable owner.

**User story:** As a PM, I need to assign each workflow, requirement, test, and risk to a named owner so blockers and approvals have clear accountability.

**Implementation notes:**
- Add owner assignment UI in decision object cards, detail views, and workspace overlays.
- Support owner changes for objects in Draft and In Review status.
- Display owner in readiness dashboard, approval queue, and blockers once those screens exist.
- Audit owner changes.
- For MVP, role-based assignment templates can be simple defaults rather than a configurable template system.

**Files likely to change:**
- `apps/api/routes/decision-objects/**`
- `packages/domain/ownership/**`
- `packages/db/repositories/role-assignments.ts`
- `apps/web/components/ownership/**`
- `apps/web/components/decision-objects/**`
- `tests/unit/ownership/**`
- `tests/e2e/ownership-assignment.spec.*`

**Data model impact:** Uses `DecisionObject.ownerId`, `RoleAssignment`, and `AuditEvent`; no new entities expected.

**UI impact:** Adds owner selectors, owner badges, and missing-owner prompts.

**Acceptance criteria:**
- PM can assign and update owners for decision objects.
- Each decision object displays its owner.
- Objects without owners are visibly flagged.
- Owner changes are audited.
- Unauthorized users cannot reassign ownership.

**Test requirements:**
- Unit tests for owner validation and authorization.
- API tests for owner assignment and unauthorized assignment.
- E2E test for assigning a requirement owner from the workspace.

**Definition of done:**
- Ownership is visible wherever decision objects are shown.
- Readiness and approval features can rely on owner data.
- Missing owner state is explicit, not hidden.

**Dependencies:** MVP-008.

## MVP-010 - Implement Traceability Link Management

**Ticket ID:** MVP-010

**Title:** Implement traceability link management

**Goal:** Allow users to link requirements to source workflows and tests/acceptance criteria.

**User story:** As a Systems Engineer, I need to connect each requirement to its workflow and acceptance criteria so readiness is based on traceable evidence.

**Implementation notes:**
- Implement `POST /api/v1/projects/{projectId}/decision-objects/{objectId}/links` and read/delete link endpoints as needed.
- Support MVP relationship types: Derived From Workflow, Validated By Test, Depends On, References.
- Enforce valid source/target object type combinations for mandatory links.
- Build a traceability panel in requirement detail view.
- Use inline linking controls instead of a full graph UI for MVP.
- Removed links should remain represented in audit history even if deleted from active links.

**Files likely to change:**
- `apps/api/routes/trace-links/**`
- `packages/domain/traceability/**`
- `packages/db/repositories/trace-links.ts`
- `apps/web/components/traceability/**`
- `apps/web/components/requirements/**`
- `tests/unit/traceability/**`
- `tests/e2e/traceability.spec.*`

**Data model impact:** Uses `TraceLink` and `AuditEvent`; no new entities expected.

**UI impact:** Adds requirement traceability panel showing required links, optional links, missing links, and link creation controls.

**Acceptance criteria:**
- User can link Requirement to Workflow.
- User can link Requirement to Test/Acceptance Criteria.
- Invalid relationship types are rejected.
- Missing mandatory links are visually flagged.
- Trace links persist and reload.
- Link creation/removal emits audit events.

**Test requirements:**
- Unit tests for relationship validation rules.
- API tests for create/read/delete trace links.
- E2E test for adding a workflow link to a requirement.

**Definition of done:**
- Mandatory traceability can be represented in data and UI.
- Readiness engine can evaluate missing workflow and test links.
- Full graph visualization remains out of scope.

**Dependencies:** MVP-008, MVP-009.

## MVP-011 - Implement Acceptance Criteria/Test Authoring

**Ticket ID:** MVP-011

**Title:** Implement acceptance criteria/test authoring

**Goal:** Let users create acceptance criteria as Test decision objects and link them to requirements.

**User story:** As an Engineering Lead, I need to define acceptance criteria for each requirement so the requirement can pass readiness validation.

**Implementation notes:**
- Add a focused acceptance criteria section in requirement detail.
- Creating an acceptance criterion creates a Test decision object and a Validated By trace link to the requirement.
- Allow editing acceptance criteria with versioning.
- Highlight requirements with no linked Test object as blocked or at risk.
- Avoid building a separate test management module in MVP.

**Files likely to change:**
- `apps/api/routes/decision-objects/**`
- `packages/domain/acceptance-criteria/**`
- `packages/domain/traceability/**`
- `apps/web/components/acceptance-criteria/**`
- `apps/web/components/requirements/**`
- `tests/unit/acceptance-criteria/**`
- `tests/e2e/acceptance-criteria.spec.*`

**Data model impact:** Uses `DecisionObject` type Test, `DecisionObjectVersion`, `TraceLink`, and `AuditEvent`; no new entities expected.

**UI impact:** Adds acceptance criteria editor and missing-test blocker prompt inside requirement detail.

**Acceptance criteria:**
- Engineering Lead can add acceptance criteria to a requirement.
- Adding acceptance criteria creates or links a Test decision object.
- Requirement traceability panel updates immediately after adding criteria.
- Acceptance criteria edits create versions.
- Requirement without acceptance criteria remains visibly incomplete.

**Test requirements:**
- Unit tests for Test object creation and automatic link creation.
- API tests for acceptance criteria create/update.
- E2E test for adding acceptance criteria and clearing the missing-test prompt.

**Definition of done:**
- Requirement-to-test readiness data is available.
- UI gives a direct path from blocker to fix.
- Acceptance criteria are versioned decision objects, not untracked text.

**Dependencies:** MVP-010.

## MVP-012 - Implement Approval Queue And Version-Specific Decisions

**Ticket ID:** MVP-012

**Title:** Implement approval queue and version-specific decisions

**Goal:** Capture approve, reject, and request-changes decisions tied to immutable object versions.

**User story:** As a Customer PM, Operator Representative, or Engineering Lead, I need a focused approval queue so I can make explicit decisions on the exact version under review.

**Implementation notes:**
- Implement `POST /api/v1/projects/{projectId}/decision-objects/{objectId}/approvals`.
- Support decisions: Approved, Rejected, Changes Requested.
- Ensure approvals reference a specific `DecisionObjectVersion`.
- Build approval queue filtered to items requiring the current user's role.
- Include object preview, owner, version, traceability status, comment field, and action buttons.
- Record all approval decisions in audit log.

**Files likely to change:**
- `apps/api/routes/approvals/**`
- `packages/domain/approvals/**`
- `packages/db/repositories/approvals.ts`
- `apps/web/routes/projects/[projectId]/approvals/**`
- `apps/web/components/approvals/**`
- `tests/unit/approvals/**`
- `tests/e2e/approval-queue.spec.*`

**Data model impact:** Uses `Approval`, `DecisionObjectVersion`, `RoleAssignment`, and `AuditEvent`.

**UI impact:** Adds approval center with pending list, object preview, comment area, and approve/reject/request changes actions.

**Acceptance criteria:**
- Assigned approver can approve a specific object version.
- Assigned approver can reject or request changes with a comment.
- Unauthorized user sees read-only status or receives an authorization error.
- Approval queue shows only relevant pending approvals for the current user.
- Approval history is visible on the object.
- AI/System actor cannot submit approvals.

**Test requirements:**
- Unit tests for approval authorization by role and object type.
- API tests for approve, reject, request changes, and unauthorized approval.
- E2E test for approving a workflow as Operator Representative.

**Definition of done:**
- Approval decisions are explicit, version-bound, and audited.
- Approval queue supports the MVP stakeholder review flow.
- Readiness engine can consume approval status.

**Dependencies:** MVP-008, MVP-009, MVP-011.

## MVP-013 - Implement Approval Invalidation And Basic Version Diff

**Ticket ID:** MVP-013

**Title:** Implement approval invalidation and basic version diff

**Goal:** Invalidate impacted approvals when meaningful content changes and provide a basic visual diff between versions.

**User story:** As an approver, I need to see what changed since my last decision so I can re-approve efficiently and avoid approving stale content.

**Implementation notes:**
- Hook approval invalidation into meaningful version creation from MVP-008.
- Mark impacted approvals Invalidated with reason and timestamp.
- Implement `GET /api/v1/projects/{projectId}/decision-objects/{objectId}/versions/diff`.
- Start with field-level or text-level diff for title/content/acceptance criteria fields.
- Show previous and current version, highlighted additions/removals, invalidated approval reason, and re-approval call to action.
- Keep advanced semantic diff out of MVP.

**Files likely to change:**
- `packages/domain/versioning/**`
- `packages/domain/approvals/**`
- `apps/api/routes/decision-objects/**`
- `apps/api/routes/diff/**`
- `apps/web/components/version-diff/**`
- `apps/web/components/approvals/**`
- `tests/unit/versioning/**`
- `tests/e2e/version-diff.spec.*`

**Data model impact:** Uses `Approval.status`, `Approval.invalidatedAt`, `Approval.invalidationReason`, and `DecisionObjectVersion`; may add diff helper output types only.

**UI impact:** Adds basic version diff viewer in approval center and object version history.

**Acceptance criteria:**
- Meaningful content edit creates a new version and invalidates relevant active approvals.
- Unrelated approvals are not invalidated when unaffected metadata changes.
- Diff endpoint returns before/after changes for two valid versions.
- Diff UI clearly shows current vs previous version.
- Invalidated approvals display reason and timestamp.
- Approver can navigate from diff back to approval action.

**Test requirements:**
- Unit tests for approval invalidation rules.
- Unit tests for diff generation.
- API tests for diff endpoint and invalidated approval state.
- E2E test for approve, edit, see invalidation, view diff, re-approve.

**Definition of done:**
- Stale approvals cannot silently remain active after meaningful change.
- Basic diff is sufficient for MVP review decisions.
- Version history is understandable to non-technical stakeholders.

**Dependencies:** MVP-012.

## MVP-014 - Implement Readiness Engine And Blocker Generation

**Ticket ID:** MVP-014

**Title:** Implement readiness engine and blocker generation

**Goal:** Compute Ready/Not Ready, readiness score, hard blockers, warnings, and override impact from structured project state.

**User story:** As a PM or leader, I need the system to objectively tell me whether a project is Ready-to-Build and why.

**Implementation notes:**
- Implement `GET /api/v1/projects/{projectId}/readiness`.
- MVP hard blockers: requirement missing workflow link, requirement missing acceptance criteria/test link, missing required approval.
- Treat authorized overrides as resolving the specific blocker for gate purposes while keeping them visible.
- Store or reproduce `ReadinessEvaluation` records with rule set version.
- Generate or update `Blocker` records with root cause object, owner, type, severity, and status.
- Readiness rule: unresolved hard blockers means Not Ready; no unresolved hard blockers means Ready.
- Readiness score is progress guidance only and never overrides hard blockers.

**Files likely to change:**
- `apps/api/routes/readiness/**`
- `packages/domain/readiness/**`
- `packages/domain/blockers/**`
- `packages/db/repositories/readiness.ts`
- `packages/db/repositories/blockers.ts`
- `tests/unit/readiness/**`
- `tests/api/readiness.spec.*`

**Data model impact:** Uses `ReadinessEvaluation`, `Blocker`, `DecisionObject`, `TraceLink`, `Approval`, `Override`, and `AuditEvent`.

**UI impact:** None directly, but returns data required by dashboard and gate UI.

**Acceptance criteria:**
- Requirement missing workflow link produces a hard blocker.
- Requirement missing acceptance criteria/test link produces a hard blocker.
- Requirement or workflow missing required approval produces a hard blocker.
- Resolved or overridden blockers do not keep the gate closed.
- Readiness status is computed, not manually set.
- Readiness score is returned and does not supersede blocker state.
- Readiness computation completes within the MVP target of 2 seconds for seeded data.

**Test requirements:**
- Unit tests for each readiness rule.
- Unit tests for overridden blocker behavior.
- API tests for Ready and Not Ready project states.
- Performance smoke test for seeded project readiness evaluation.

**Definition of done:**
- The platform has a trustworthy computed gate.
- Blockers are actionable and linked to root cause objects.
- Readiness logic is centralized, deterministic, and rule-versioned.

**Dependencies:** MVP-010, MVP-011, MVP-013.

## MVP-015 - Build Readiness Dashboard And Project Gate UI

**Ticket ID:** MVP-015

**Title:** Build readiness dashboard and project gate UI

**Goal:** Explain project readiness status, blockers, owners, pending approvals, risks, overrides, and next actions in one leadership-ready view.

**User story:** As a leader or PM, I need to instantly understand whether the project is Ready-to-Build, what is blocking it, and who owns each action.

**Implementation notes:**
- Build dashboard using readiness endpoint from MVP-014.
- Show Ready/Not Ready state, readiness score, hard blockers, warnings, pending approvals, open risks, owner per blocker, and override summary.
- Clicking a blocker opens the related object or direct fix location.
- Clicking readiness score shows score breakdown.
- Overrides must be visually prominent and cannot be hidden.
- Jira export entry point remains disabled until Ready or authorized override state.

**Files likely to change:**
- `apps/web/routes/projects/[projectId]/dashboard/**`
- `apps/web/routes/projects/[projectId]/readiness/**`
- `apps/web/components/readiness/**`
- `apps/web/components/blockers/**`
- `apps/web/components/project/**`
- `tests/e2e/readiness-dashboard.spec.*`

**Data model impact:** None beyond consuming readiness, blocker, approval, risk, and override records.

**UI impact:** Adds project dashboard, readiness dashboard, blocker list, owner visibility, readiness score breakdown, and gate status panel.

**Acceptance criteria:**
- Dashboard displays computed Ready/Not Ready status.
- Dashboard lists active hard blockers with owner and root cause.
- Dashboard shows pending approval count and open risk count.
- Blocker click opens the relevant object or fix panel.
- Override summary is visible when overrides exist.
- Jira export action is disabled while the gate is closed.
- Executive Viewer can view but cannot edit, approve, override, or export.

**Test requirements:**
- Component tests for Ready and Not Ready dashboard states.
- E2E test for navigating from blocker to requirement fix.
- E2E test for Executive Viewer read-only dashboard behavior.

**Definition of done:**
- Readiness is obvious and actionable.
- Dashboard can serve as the PM/leadership home for MVP.
- Gate state is consistent with backend readiness computation.

**Dependencies:** MVP-014.

## MVP-016 - Implement Override And Risk Acceptance Workflow

**Ticket ID:** MVP-016

**Title:** Implement override and risk acceptance workflow

**Goal:** Allow authorized PM-level users to explicitly accept risk for specific blockers without hiding the risk.

**User story:** As a PM, I need to override a blocker only with a named reason and risk acknowledgment so development can proceed under visible, auditable risk acceptance.

**Implementation notes:**
- Implement `POST /api/v1/projects/{projectId}/overrides`.
- Require blocker IDs, reason, risk acknowledgment, authorized user, and PM-or-higher authority.
- Overrides are immutable after creation.
- Update blocker status to Overridden or have readiness engine treat linked blockers as overridden.
- Display override on dashboard, readiness gate, and audit stream.
- Block silent or implicit overrides.

**Files likely to change:**
- `apps/api/routes/overrides/**`
- `packages/domain/overrides/**`
- `packages/domain/readiness/**`
- `packages/db/repositories/overrides.ts`
- `apps/web/components/overrides/**`
- `apps/web/components/readiness/**`
- `tests/unit/overrides/**`
- `tests/e2e/override-workflow.spec.*`

**Data model impact:** Uses `Override`, `Blocker`, `RoleAssignment`, and `AuditEvent`.

**UI impact:** Adds override/risk acceptance panel with blocker summary, reason, risk acknowledgment, authority confirmation, and visible override banner.

**Acceptance criteria:**
- PM can submit an override for one or more open blockers.
- Reason and risk acknowledgment are required.
- Non-PM user cannot submit override.
- Override is linked to specific blocker IDs.
- Override appears on dashboard and readiness gate.
- Override action emits audit event with user, reason, timestamp, and blocker links.
- Readiness endpoint treats overridden blockers according to MVP override rule.

**Test requirements:**
- Unit tests for override validation and authorization.
- API tests for successful override, missing reason, missing acknowledgment, and unauthorized override.
- E2E test for submitting override and seeing gate/export state update.

**Definition of done:**
- Overrides are accountable, visible, and auditable.
- No blocker can be bypassed without a named risk acceptance record.
- Dashboard cannot hide override state.

**Dependencies:** MVP-014, MVP-015.

## MVP-017 - Implement Certification Package Preview

**Ticket ID:** MVP-017

**Title:** Implement certification package preview

**Goal:** Generate a Ready-to-Build package snapshot that summarizes approved workflows, requirements, traceability, approvals, risks, blockers, and overrides.

**User story:** As an Engineering Lead or PM, I need to preview the certification package before Jira export so I can verify the approved baseline and traceability handoff.

**Implementation notes:**
- Implement `POST /api/v1/projects/{projectId}/certification-package`.
- For MVP, generated package can be JSON/HTML preview plus downloadable artifact if storage is available.
- Require Ready state or authorized override state before generation.
- Include version IDs, approval records, traceability matrix, risks, and override log.
- Store package metadata and status.
- Failed generation should be visible and retryable.

**Files likely to change:**
- `apps/api/routes/certification-package/**`
- `packages/domain/certification/**`
- `packages/db/repositories/certification-packages.ts`
- `packages/storage/**`
- `apps/web/routes/projects/[projectId]/certification/**`
- `apps/web/components/certification/**`
- `tests/unit/certification/**`
- `tests/e2e/certification-package.spec.*`

**Data model impact:** Uses `CertificationPackage`, `DecisionObjectVersion`, `Approval`, `TraceLink`, `Risk` decision objects, `Override`, and `AuditEvent`.

**UI impact:** Adds certification package page or panel with included artifacts checklist, readiness status, package preview, and generation status.

**Acceptance criteria:**
- Package generation is blocked when project is Not Ready and has no valid override state.
- Package can be generated when Ready or valid override state permits.
- Package includes version identifiers for included decision objects.
- Package includes traceability, approvals, risks, and overrides.
- Generated package metadata persists and reloads.
- Generation emits audit event.

**Test requirements:**
- Unit tests for package eligibility and package content assembly.
- API tests for blocked and successful package generation.
- E2E test for generating package after readiness is achieved.

**Definition of done:**
- Project has a concrete Ready-to-Build artifact before Jira handoff.
- Package is auditable and tied to exact versions.
- Certification preview supports final PM/engineering review.

**Dependencies:** MVP-015, MVP-016.

## MVP-018 - Implement Jira Export Gating And Preview

**Ticket ID:** MVP-018

**Title:** Implement Jira export gating and preview

**Goal:** Enforce that Jira export is blocked until Ready-to-Build or valid override state, then generate epics/stories with traceability metadata.

**User story:** As an Engineering Lead, I need the system to block Jira export until readiness is achieved so execution cannot start from incomplete requirements.

**Implementation notes:**
- Implement `POST /api/v1/projects/{projectId}/integrations/jira/export` and `GET /api/v1/projects/{projectId}/integrations/jira/export-jobs/{exportJobId}`.
- Add Jira adapter with mock/local implementation for MVP and real adapter boundary for later.
- Generate export preview before actual export: epic/story title, description, source requirement ID, version ID, approval metadata, workflow link, and acceptance criteria link.
- Block export unless readiness is Ready or authorized override state permits.
- Preserve traceability metadata in export job result.
- Handle partial failures and retry state.

**Files likely to change:**
- `apps/api/routes/integrations/jira/**`
- `packages/domain/jira-export/**`
- `packages/integrations/jira/**`
- `packages/db/repositories/jira-export-jobs.ts`
- `apps/web/routes/projects/[projectId]/jira-export/**`
- `apps/web/components/jira-export/**`
- `tests/unit/jira-export/**`
- `tests/e2e/jira-export.spec.*`

**Data model impact:** Uses `JiraExport`, `CertificationPackage`, `ReadinessEvaluation`, `DecisionObject`, `DecisionObjectVersion`, `TraceLink`, `Approval`, and `AuditEvent`.

**UI impact:** Adds Jira export page with disabled blocked state, blocker explanation, export preview, target project key field, status panel, and failure/retry state.

**Acceptance criteria:**
- Jira export button is disabled or blocked while project is Not Ready.
- Blocked export attempt returns PROJECT_NOT_READY with blocker explanation.
- Ready project can generate an export preview.
- Exported stories include traceability metadata back to source requirements and versions.
- Export job status can be viewed after submission.
- Failed or partial export shows actionable error and retry option.
- Export attempts emit audit events.

**Test requirements:**
- Unit tests for export eligibility and mapping requirements to Jira payloads.
- API tests for blocked export, successful queued export, status retrieval, and failure state.
- E2E test for blocked export before readiness and successful preview/export after readiness.

**Definition of done:**
- Jira handoff is a real enforcement point in the MVP.
- Export preserves enough traceability for engineering to trust generated work items.
- Integration boundary can be swapped for real Jira API credentials later.

**Dependencies:** MVP-017.

## MVP-019 - Implement Audit Trail MVP

**Ticket ID:** MVP-019

**Title:** Implement audit trail MVP

**Goal:** Provide immutable, attributable records for sensitive and readiness-relevant actions.

**User story:** As a leadership or governance user, I need a clear audit trail so I can see who changed, approved, overrode, or exported readiness artifacts.

**Implementation notes:**
- Centralize audit event creation for project creation, document upload, AI generation, decision object edits, version creation, trace links, approvals, approval invalidations, readiness transitions, blocker changes, overrides, certification package generation, and Jira export.
- Add audit list API scoped to project.
- Add UI panel on project dashboard or certification page showing key audit events.
- MVP immutability can be append-only application behavior; tamper-evident hashes can be deferred unless easy to include.
- Sensitive actions should fail closed if audit event creation fails.

**Files likely to change:**
- `packages/domain/audit/**`
- `packages/db/repositories/audit-events.ts`
- `apps/api/routes/audit/**`
- Existing route/domain files from MVP-004 through MVP-018
- `apps/web/components/audit/**`
- `tests/unit/audit/**`
- `tests/e2e/audit-trail.spec.*`

**Data model impact:** Uses `AuditEvent`; may add standardized event type enums and entity references.

**UI impact:** Adds project audit activity panel with filters or simple chronological list.

**Acceptance criteria:**
- Sensitive actions produce audit events with actor, event type, entity type, entity ID, timestamp, and details.
- Approval, override, and export actions always emit audit events.
- Audit events are append-only through normal application APIs.
- Project audit feed is visible to PM and Executive Viewer.
- Unauthorized users cannot view audit events for projects they cannot access.
- If audit write fails for approval, override, or export, the sensitive action does not complete.

**Test requirements:**
- Unit tests for audit event builder and fail-closed behavior.
- API tests for audit feed authorization.
- Integration tests proving approval, override, and export create audit records.
- E2E test for seeing override and export attempts in audit feed.

**Definition of done:**
- MVP has end-to-end accountability for readiness decisions.
- Audit trail supports leadership review and pilot validation.
- Sensitive actions cannot silently bypass logging.

**Dependencies:** MVP-018.

## MVP-020 - Add End-To-End MVP Happy Path And Pilot Fixtures

**Ticket ID:** MVP-020

**Title:** Add end-to-end MVP happy path and pilot fixtures

**Goal:** Prove the full MVP lifecycle from project creation through document upload, AI draft generation, approvals, readiness, certification, and Jira export gating.

**User story:** As the product team, we need a repeatable pilot scenario so we can validate that the MVP prevents irresponsible project starts and demonstrates the core value.

**Implementation notes:**
- Create a realistic pilot fixture with source document text, generated workflow, requirements, risks, acceptance criteria, trace links, approvals, blockers, override case, certification output, and Jira export preview.
- Add E2E tests for both paths: resolve blockers to Ready and override blockers with visible risk acceptance.
- Add a smoke test script that resets seed data and runs the happy path.
- Add documentation describing the MVP demo flow and expected readiness transitions.
- Include performance smoke checks for AI mock completion, UI interactions, and readiness computation.

**Files likely to change:**
- `tests/e2e/mvp-happy-path.spec.*`
- `tests/fixtures/mvp-pilot/**`
- `packages/db/seed/**`
- `docs/codex/mvp-demo-flow.md`
- `README.md`
- `package.json`

**Data model impact:** No schema changes expected; adds richer seed/fixture data.

**UI impact:** No new UI features expected; may add minor test IDs or empty-state polish discovered while writing E2E tests.

**Acceptance criteria:**
- E2E test proves Not Ready state blocks Jira export.
- E2E test proves resolving missing traceability, missing acceptance criteria, and missing approval blockers opens the gate.
- E2E test proves PM override opens permitted path while keeping override visible.
- E2E test proves certification package can be generated before Jira export.
- E2E test proves Jira export preview includes traceability metadata.
- Demo documentation clearly explains the MVP flow.

**Test requirements:**
- Full E2E happy path test.
- Full E2E override path test.
- Smoke performance checks for readiness computation target and normal UI responsiveness.
- Regression check that AI/System cannot approve or override.

**Definition of done:**
- A new Codex session can run the MVP tests and understand the demo flow.
- The MVP demonstrates the hard gate before development.
- Pilot scenario is realistic enough for stakeholder walkthroughs.

**Dependencies:** MVP-019.
