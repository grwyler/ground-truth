# Data Model and Data Dictionary

**Pre-Development Readiness Platform**

---

## 1. Overview

The platform uses a **decision-object-centric data model**. The core unit of the system is a versioned, owned, traceable decision object representing something that must be true before development begins.

The model supports:

- AI-assisted draft generation
- Human-owned decisions
- Explicit approvals
- Version-aware change control
- Traceability enforcement
- Readiness computation
- Override governance
- Jira/export handoff

---

# 2. Entity List

| Entity                  | Description                                                                  |
| ----------------------- | ---------------------------------------------------------------------------- |
| Project                 | Top-level container for readiness work                                       |
| Source Document         | Uploaded SOWs, proposals, notes, legacy docs                                 |
| AI Generation Job       | AI processing run that produces draft objects                                |
| Decision Object         | Core versioned object representing a workflow, requirement, test, risk, etc. |
| Decision Object Version | Immutable version snapshot of a decision object                              |
| Traceability Link       | Relationship between decision objects                                        |
| Approval                | Explicit approval/rejection tied to an object version                        |
| Readiness Evaluation    | Computed readiness state for a project                                       |
| Blocker                 | Hard issue preventing Ready-to-Build status                                  |
| Override                | Formal risk acceptance for one or more blockers                              |
| Certification Package   | Generated Ready-to-Build output package                                      |
| Jira Export Job         | Controlled export of approved requirements into Jira                         |
| User                    | Individual platform user                                                     |
| Role Assignment         | User’s project-level or object-level responsibility                          |
| Audit Event             | Immutable record of sensitive or meaningful system activity                  |

---

# 3. Entity Descriptions and Field Definitions

---

## 3.1 Project

### Description

Represents a customer/program effort being evaluated for Ready-to-Build certification.

### Source of Truth

Platform database.

| Field           |     Type | Required | Description                                  |
| --------------- | -------: | -------: | -------------------------------------------- |
| projectId       |     UUID | Required | Unique project identifier                    |
| name            |   String | Required | Project name                                 |
| description     |     Text | Optional | Project summary                              |
| customer        |   String | Optional | Customer or government organization          |
| contractNumber  |   String | Optional | Contract identifier                          |
| programName     |   String | Optional | Program name                                 |
| status          |     Enum | Required | Draft, In Review, Not Ready, Ready, Archived |
| readinessStatus |     Enum | Required | Ready / Not Ready                            |
| readinessScore  |  Integer | Optional | 0–100 computed readiness score               |
| createdBy       |     UUID | Required | User who created project                     |
| createdAt       | DateTime | Required | Creation timestamp                           |
| updatedAt       | DateTime | Required | Last update timestamp                        |

### Validation Rules

- Project name is required.
- Readiness status is system-computed.
- Ready status cannot be manually assigned.

### Audit / History Requirements

- Creation, status changes, readiness transitions, and archival must be logged.

---

## 3.2 Source Document

### Description

Represents uploaded project inputs such as SOWs, proposals, PDFs, notes, and legacy documents.

### Source of Truth

Original uploaded file and extracted metadata stored by platform.

| Field            |     Type | Required | Description                                         |
| ---------------- | -------: | -------: | --------------------------------------------------- |
| documentId       |     UUID | Required | Unique document identifier                          |
| projectId        |     UUID | Required | Associated project                                  |
| fileName         |   String | Required | Original file name                                  |
| documentType     |     Enum | Optional | SOW, Proposal, Legacy Doc, Notes, Constraint, Other |
| storageUri       |   String | Required | Secure object storage location                      |
| uploadStatus     |     Enum | Required | Uploaded, Processing, Parsed, Failed                |
| uploadedBy       |     UUID | Required | Uploading user                                      |
| uploadedAt       | DateTime | Required | Upload timestamp                                    |
| extractedTextUri |   String | Optional | Location of parsed text                             |
| checksum         |   String | Required | File integrity hash                                 |

### Validation Rules

- File must be supported type.
- File checksum must be recorded.
- Failed parsing must not delete original source document.

### Audit / History Requirements

- Uploads, deletions, parse failures, and replacements must be logged.

---

## 3.3 AI Generation Job

### Description

Represents an AI processing request used to generate drafts, risks, workflows, requirements, or Jira structures.

### Source of Truth

AI job record plus generated draft outputs.

| Field           |     Type | Required | Description                                                 |
| --------------- | -------: | -------: | ----------------------------------------------------------- |
| generationJobId |     UUID | Required | Unique job identifier                                       |
| projectId       |     UUID | Required | Associated project                                          |
| documentIds     |   UUID[] | Required | Source documents used                                       |
| status          |     Enum | Required | Queued, Running, Completed, Failed                          |
| generationScope | String[] | Required | Workflows, Requirements, Risks, Assumptions, Infrastructure |
| aiSchemaVersion |   String | Required | AI output schema version                                    |
| createdBy       |     UUID | Required | User who triggered job                                      |
| createdAt       | DateTime | Required | Job creation timestamp                                      |
| completedAt     | DateTime | Optional | Job completion timestamp                                    |
| errorMessage    |     Text | Optional | Failure reason                                              |

### Validation Rules

- AI outputs are draft only.
- AI may create suggestions but not approvals or overrides.

### Audit / History Requirements

- AI job creation, completion, failure, and generated outputs must be logged.

---

## 3.4 Decision Object

### Description

Core entity representing a decision that must be defined, owned, approved, linked, or validated before development begins.

Examples:

- Workflow
- Requirement
- Acceptance Criteria / Test
- Risk
- Assumption
- Infrastructure Dependency
- Interface
- Architecture Reference
- Data Object

### Source of Truth

Platform database; current version points to latest authoritative version.

| Field          |     Type | Required | Description                                                                                  |
| -------------- | -------: | -------: | -------------------------------------------------------------------------------------------- |
| objectId       |     UUID | Required | Unique object identifier                                                                     |
| projectId      |     UUID | Required | Associated project                                                                           |
| type           |     Enum | Required | Workflow, Requirement, Test, Risk, Assumption, Infrastructure, Interface, Architecture, Data |
| title          |   String | Required | Object title                                                                                 |
| currentVersion |  Integer | Required | Current active version number                                                                |
| status         |     Enum | Required | Draft, In Review, Approved, Rejected, Invalidated                                            |
| ownerId        |     UUID | Required | Accountable owner                                                                            |
| priority       |     Enum | Optional | Critical, High, Medium, Low                                                                  |
| createdBy      |     UUID | Required | Creator                                                                                      |
| createdAt      | DateTime | Required | Creation timestamp                                                                           |
| updatedAt      | DateTime | Required | Last update timestamp                                                                        |

### Validation Rules

- Every decision object must have an owner.
- Requirement objects must link to at least one workflow.
- Requirement objects must link to at least one test/acceptance criterion.
- Approved objects cannot be modified in place; meaningful changes create a new version.

### Audit / History Requirements

- Creation, ownership changes, status changes, and version changes must be logged.

---

## 3.5 Decision Object Version

### Description

Immutable snapshot of a decision object at a specific point in time.

### Source of Truth

Platform database; immutable once created.

| Field            |      Type | Required | Description                                    |
| ---------------- | --------: | -------: | ---------------------------------------------- |
| versionId        |      UUID | Required | Unique version identifier                      |
| objectId         |      UUID | Required | Parent decision object                         |
| versionNumber    |   Integer | Required | Sequential version number                      |
| content          | JSON/Text | Required | Versioned object content                       |
| changeReason     |      Text | Optional | User-provided reason for change                |
| changedBy        |      UUID | Required | User or system that created version            |
| createdAt        |  DateTime | Required | Version timestamp                              |
| meaningfulChange |   Boolean | Required | Indicates whether approvals may be invalidated |

### Validation Rules

- Versions are immutable.
- Meaningful changes include logic, behavior, or acceptance criteria changes.
- New versions must preserve prior version history.

### Audit / History Requirements

- All versions retained.
- Visual diff must be available between versions.

---

## 3.6 Traceability Link

### Description

Represents a relationship between two decision objects.

### Source of Truth

Platform traceability graph.

| Field                |     Type | Required | Description                                                            |
| -------------------- | -------: | -------: | ---------------------------------------------------------------------- |
| linkId               |     UUID | Required | Unique link identifier                                                 |
| projectId            |     UUID | Required | Associated project                                                     |
| sourceObjectId       |     UUID | Required | Origin object                                                          |
| targetObjectId       |     UUID | Required | Linked object                                                          |
| relationshipType     |     Enum | Required | Derived From, Validated By, Depends On, Implements, References, Blocks |
| requiredForReadiness |  Boolean | Required | Whether link is required for gate                                      |
| createdBy            |     UUID | Required | User/system creating link                                              |
| createdAt            | DateTime | Required | Creation timestamp                                                     |

### Validation Rules

- Requirement → Workflow link is mandatory.
- Requirement → Test/Acceptance Criteria link is mandatory.
- Architecture/interface/data links are conditional.
- Invalid relationship types are rejected.

### Audit / History Requirements

- Link creation and deletion must be logged.
- Removed links must remain visible in history.

---

## 3.7 Approval

### Description

Explicit stakeholder decision tied to a specific decision object version.

### Source of Truth

Platform approval record.

| Field              |     Type | Required | Description                           |
| ------------------ | -------: | -------: | ------------------------------------- |
| approvalId         |     UUID | Required | Unique approval identifier            |
| objectId           |     UUID | Required | Approved object                       |
| versionId          |     UUID | Required | Approved version                      |
| approverId         |     UUID | Required | User approving/rejecting              |
| decision           |     Enum | Required | Approved, Rejected, Changes Requested |
| comment            |     Text | Optional | Approval/rejection notes              |
| status             |     Enum | Required | Active, Invalidated                   |
| createdAt          | DateTime | Required | Approval timestamp                    |
| invalidatedAt      | DateTime | Optional | Invalidation timestamp                |
| invalidationReason |     Text | Optional | Reason approval was invalidated       |

### Validation Rules

- Approval must reference a specific immutable version.
- AI cannot approve.
- Users may only approve objects they are authorized to approve.
- Relevant approvals are invalidated when content changes.

### Audit / History Requirements

- Approvals and invalidations must be permanently logged.

---

## 3.8 Readiness Evaluation

### Description

Computed project readiness result based on system state.

### Source of Truth

Readiness engine output.

| Field          |     Type | Required | Description                          |
| -------------- | -------: | -------: | ------------------------------------ |
| evaluationId   |     UUID | Required | Unique evaluation identifier         |
| projectId      |     UUID | Required | Associated project                   |
| status         |     Enum | Required | Ready, Not Ready                     |
| readinessScore |  Integer | Required | 0–100 progress score                 |
| ruleSetVersion |   String | Required | Readiness rules version              |
| evaluatedAt    | DateTime | Required | Evaluation timestamp                 |
| evaluatedBy    |     Enum | Required | System                               |
| summary        |     Text | Optional | Human-readable readiness explanation |

### Validation Rules

- Ready/Not Ready must be computed, not manually set.
- Hard blockers override readiness score.
- Project can be 90%+ complete and still Not Ready.

### Audit / History Requirements

- Each readiness evaluation should be stored or reproducible.
- Readiness transitions must be logged.

---

## 3.9 Blocker

### Description

Hard issue preventing Ready-to-Build status.

### Source of Truth

Readiness engine.

| Field       |     Type | Required | Description                                                                                         |
| ----------- | -------: | -------: | --------------------------------------------------------------------------------------------------- |
| blockerId   |     UUID | Required | Unique blocker identifier                                                                           |
| projectId   |     UUID | Required | Associated project                                                                                  |
| objectId    |     UUID | Optional | Related decision object                                                                             |
| type        |     Enum | Required | Missing Approval, Missing Traceability, Open Critical Risk, Infrastructure Gap, Jira Export Blocked |
| severity    |     Enum | Required | Critical, High                                                                                      |
| description |     Text | Required | Explanation of blocker                                                                              |
| status      |     Enum | Required | Open, Resolved, Overridden                                                                          |
| createdAt   | DateTime | Required | Creation timestamp                                                                                  |
| resolvedAt  | DateTime | Optional | Resolution timestamp                                                                                |

### Validation Rules

- Only objectively irresponsible start conditions should become hard blockers.
- Blockers must link to root cause where possible.

### Audit / History Requirements

- Blocker creation, resolution, and override status must be logged.

---

## 3.10 Override

### Description

Formal risk acceptance allowing progress despite one or more blockers.

### Source of Truth

Platform override record.

| Field              |     Type | Required | Description                |
| ------------------ | -------: | -------: | -------------------------- |
| overrideId         |     UUID | Required | Unique override identifier |
| projectId          |     UUID | Required | Associated project         |
| blockerIds         |   UUID[] | Required | Blockers being overridden  |
| authorizedBy       |     UUID | Required | Named authority            |
| authorityRole      |     Enum | Required | PM, Director, VP, Admin    |
| reason             |     Text | Required | Reason for override        |
| riskAcknowledgment |     Text | Required | Explicit accepted risk     |
| createdAt          | DateTime | Required | Override timestamp         |
| visibility         |     Enum | Required | DashboardAndAuditTrail     |

### Validation Rules

- Override requires PM or higher authority.
- Override must be tied to specific blocker(s).
- Override requires reason and explicit risk acknowledgment.
- Overrides cannot be silent or implicit.

### Audit / History Requirements

- Overrides are immutable.
- Overrides must remain visible in dashboard and audit trail.

---

## 3.11 Certification Package

### Description

Generated Ready-to-Build output package.

### Source of Truth

Generated artifact plus platform metadata.

| Field                      |     Type | Required | Description                   |
| -------------------------- | -------: | -------: | ----------------------------- |
| packageId                  |     UUID | Required | Unique package identifier     |
| projectId                  |     UUID | Required | Associated project            |
| status                     |     Enum | Required | Generated, Failed, Superseded |
| generatedBy                |     UUID | Required | User requesting package       |
| generatedAt                | DateTime | Required | Generation timestamp          |
| packageUri                 |   String | Required | Storage location              |
| includesTraceabilityMatrix |  Boolean | Required | Whether traceability included |
| includesApprovals          |  Boolean | Required | Whether approvals included    |
| includesRisks              |  Boolean | Required | Whether risks included        |
| includesOverrides          |  Boolean | Required | Whether overrides included    |

### Validation Rules

- Certification package cannot be generated unless project is Ready or authorized override state permits generation.
- Package must include version identifiers.

### Audit / History Requirements

- Package generation and downloads should be logged.

---

## 3.12 Jira Export Job

### Description

Tracks export of approved requirements into Jira.

### Source of Truth

Platform export job record and Jira issue references.

| Field             |     Type | Required | Description                                 |
| ----------------- | -------: | -------: | ------------------------------------------- |
| exportJobId       |     UUID | Required | Unique export job identifier                |
| projectId         |     UUID | Required | Associated project                          |
| jiraProjectKey    |   String | Required | Target Jira project                         |
| status            |     Enum | Required | Queued, Running, Completed, Failed, Partial |
| createdBy         |     UUID | Required | User initiating export                      |
| createdAt         | DateTime | Required | Export timestamp                            |
| completedAt       | DateTime | Optional | Completion timestamp                        |
| jiraIssueMappings |     JSON | Optional | Object-to-Jira issue mapping                |
| errorSummary      |     Text | Optional | Failure details                             |

### Validation Rules

- Jira export is blocked unless Ready-to-Build is achieved.
- Exported items must preserve traceability links.

### Audit / History Requirements

- Export attempts, successes, failures, and created Jira issue keys must be logged.

---

## 3.13 User

### Description

Platform user participating in readiness workflows.

### Source of Truth

Identity provider for identity; platform for project-specific metadata.

| Field              |     Type | Required | Description                 |
| ------------------ | -------: | -------: | --------------------------- |
| userId             |     UUID | Required | Platform user identifier    |
| externalIdentityId |   String | Required | SSO/OIDC/SAML identity      |
| name               |   String | Required | Display name                |
| email              |   String | Required | Email address               |
| organizationId     |     UUID | Required | Tenant organization         |
| status             |     Enum | Required | Active, Disabled            |
| createdAt          | DateTime | Required | First platform registration |

### Validation Rules

- Users must belong to a tenant.
- Disabled users cannot approve or override.

### Audit / History Requirements

- Login, permission-sensitive actions, and account changes must be logged.

---

## 3.14 Role Assignment

### Description

Maps users to project-level or object-level responsibilities.

### Source of Truth

Platform RBAC / project configuration.

| Field            |     Type | Required | Description                                                                      |
| ---------------- | -------: | -------: | -------------------------------------------------------------------------------- |
| roleAssignmentId |     UUID | Required | Unique assignment identifier                                                     |
| projectId        |     UUID | Required | Associated project                                                               |
| userId           |     UUID | Required | Assigned user                                                                    |
| role             |     Enum | Required | PM, Engineering Lead, Systems Engineer, Operator Rep, Customer PM, Viewer, Admin |
| scope            |     Enum | Required | Project, Object                                                                  |
| objectId         |     UUID | Optional | Required when scope is Object                                                    |
| assignedBy       |     UUID | Required | Assigning user                                                                   |
| assignedAt       | DateTime | Required | Assignment timestamp                                                             |

### Validation Rules

- Object-level role assignment requires objectId.
- Override authority limited to PM or higher.
- Approval authority depends on role and object type.

### Audit / History Requirements

- Role assignments and changes must be logged.

---

## 3.15 Audit Event

### Description

Immutable record of significant system activity.

### Source of Truth

Audit logging service.

| Field         |     Type | Required | Description                                                                |
| ------------- | -------: | -------: | -------------------------------------------------------------------------- |
| auditEventId  |     UUID | Required | Unique audit event identifier                                              |
| projectId     |     UUID | Optional | Associated project                                                         |
| actorId       |     UUID | Optional | User/system performing action                                              |
| eventType     |     Enum | Required | Create, Update, Approve, Reject, Override, Export, Login, PermissionDenied |
| entityType    |   String | Required | Entity affected                                                            |
| entityId      |     UUID | Optional | Entity identifier                                                          |
| timestamp     | DateTime | Required | Event time                                                                 |
| details       |     JSON | Required | Event details                                                              |
| immutableHash |   String | Optional | Tamper-evidence hash                                                       |

### Validation Rules

- Sensitive actions must emit audit events.
- Approval, override, export, and permission failures must always be logged.

### Audit / History Requirements

- Audit events are immutable.
- Audit logs must be retained per policy.

---

# 4. Relationships Between Entities

## Core Relationships

| Relationship                         |  Cardinality | Description                                   |
| ------------------------------------ | -----------: | --------------------------------------------- |
| Project → Source Documents           |    1-to-many | A project may contain many uploaded documents |
| Project → Decision Objects           |    1-to-many | A project contains many decision objects      |
| Decision Object → Versions           |    1-to-many | Each object has version history               |
| Decision Object → Traceability Links | many-to-many | Objects relate through graph links            |
| Decision Object Version → Approvals  |    1-to-many | Approvals apply to exact versions             |
| Project → Readiness Evaluations      |    1-to-many | Readiness may be recomputed repeatedly        |
| Readiness Evaluation → Blockers      |    1-to-many | Evaluation may identify blockers              |
| Blockers → Overrides                 | many-to-many | One override may address multiple blockers    |
| Project → Certification Packages     |    1-to-many | Multiple packages may be generated over time  |
| Project → Jira Export Jobs           |    1-to-many | Exports are tracked as jobs                   |
| User → Role Assignments              |    1-to-many | Users may hold multiple roles                 |
| Entity → Audit Events                |    1-to-many | Entities generate audit events                |

---

# 5. Key Validation Rules

## Requirement Validation

- Every requirement must link to at least one workflow.
- Every requirement must link to at least one test or acceptance criterion.
- Requirement approval is version-specific.
- Meaningful changes create a new version.

## Workflow Validation

- Workflow must be approved by assigned Operator Rep.
- Workflow-derived requirements must maintain source links.

## Approval Validation

- AI cannot approve.
- Approval requires authorized human.
- Relevant approvals invalidate when underlying content changes.

## Readiness Validation

- Ready status requires no unresolved hard blockers.
- Hard blockers may only be resolved or explicitly overridden.
- Readiness score does not supersede hard blocker status.

## Override Validation

- Override requires PM or higher authority.
- Override requires reason and risk acknowledgment.
- Override must be visible and auditable.

## Jira Export Validation

- Jira export blocked until Ready-to-Build.
- Exported Jira items must include traceability back to source requirement.

---

# 6. Audit / History Requirements

The system must retain history for:

- Source document uploads
- AI generation jobs
- Decision object creation and edits
- All decision object versions
- Traceability link creation/removal
- Approvals, rejections, and invalidations
- Readiness evaluations
- Blocker creation/resolution
- Overrides
- Certification package generation
- Jira exports
- Permission-sensitive events

Audit logs must be:

- Immutable
- Timestamped
- Attributable to user/system actor
- Tenant-scoped
- Retained according to configurable retention policy

---

# 7. Assumptions

- Decision Object is the primary atomic unit.
- Requirements are the main gating object for MVP.
- Workflow → Requirement → Test traceability is mandatory.
- Architecture, interface, infrastructure, and data links are conditional.
- AI outputs are drafts and never authoritative.
- Jira export is one-way for MVP.
- Readiness is computed, not manually assigned.

---

# 8. Risks

- Data model may become too abstract if Decision Object tries to represent too many entity types.
- Traceability graph may become difficult to navigate at scale.
- Versioning and approval invalidation logic may be complex.
- Readiness computation depends on accurate relationship data.
- Poorly defined “meaningful change” rules could cause either too many or too few approval invalidations.
- Audit storage volume may grow quickly in enterprise environments.

---

# 9. Open Questions

1. Should Decision Object be a polymorphic entity or should major object types have dedicated tables?
2. What exact fields differ by object type?
3. Should readiness rules be tenant-configurable?
4. How should “meaningful change” be detected: manually, automatically, or hybrid?
5. Should traceability graph be stored in a graph database, relational schema, or hybrid model?
6. What retention periods are required for audit logs and version history?
7. Should Jira issue mappings remain one-way or support future bidirectional sync?
8. How should certification package snapshots relate to later project changes?
