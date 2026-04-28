# Platform Requirements & MVP Specification

**Pre-Development Readiness Platform**

---

## 1. Overview

This document translates the Product Source of Truth into a **build-ready platform specification**. It defines the MVP feature set, core system components, data model, user roles, workflows, and phased roadmap required to deliver the product.

The objective of the MVP is:

> **Prevent software teams from starting development under conditions that make success unlikely.**

---

## 2. MVP Feature Set

### 2.1 Core Principle

Deliver the smallest system that:

- Enforces readiness
- Blocks irresponsible project starts
- Produces a **Ready / Not Ready** decision

---

## 2.2 MVP Features

### 2.2.1 Project Intake

- Create project
- Upload SOW and supporting documents
- Store and manage uploaded files

---

### 2.2.2 AI Draft Generation

- Parse uploaded documents
- Generate:
  - Workflows (basic)
  - Requirements (basic)
  - Risks (basic)

- Outputs are editable in a document-style interface

---

### 2.2.3 Decision Object System (Simplified)

Supported object types:

- Workflow
- Requirement
- Acceptance Criteria (Test)
- Risk

Each object includes:

- Owner
- Version
- Status
- Approvals

---

### 2.2.4 Traceability Enforcement (Critical)

Mandatory:

- Requirement → Workflow
- Requirement → Acceptance Criteria

Missing links = **hard blocker**

---

### 2.2.5 Approval System

- Assign owner per object
- Approve / reject actions
- Version-based approvals
- Approval invalidation on change

---

### 2.2.6 Readiness Engine

Computes:

- Ready / Not Ready
- (Optional) readiness score

Hard blockers:

- Missing approval
- Missing traceability
- Missing acceptance criteria

---

### 2.2.7 Readiness Dashboard

Displays:

- Ready / Not Ready status
- Blockers
- Owner per blocker
- Overrides

---

### 2.2.8 Override System

- PM-level authority required
- Must include:
  - Reason
  - Risk acknowledgment

- Fully visible and auditable

---

### 2.2.9 Jira Integration (Enforcement Layer)

- Export blocked until Ready
- On Ready:
  - Generate epics/stories
  - Include traceability metadata

---

## 3. User Roles (MVP)

| Role                    | Description                                                      |
| ----------------------- | ---------------------------------------------------------------- |
| Program Manager (PM)    | Owns project, assigns ownership, manages readiness, can override |
| Engineering Lead        | Validates technical feasibility, approves requirements           |
| Operator Representative | Validates workflows                                              |
| Customer PM             | Approves requirements                                            |
| Executive Viewer        | Views readiness dashboard                                        |

---

## 4. Database Entities (MVP)

### 4.1 Project

- id
- name
- status
- readiness_status
- readiness_score

---

### 4.2 Document

- id
- project_id
- file_path
- type
- parsed_text

---

### 4.3 DecisionObject

- id
- project_id
- type (workflow, requirement, test, risk)
- title
- owner_id
- current_version

---

### 4.4 DecisionObjectVersion

- id
- object_id
- version_number
- content (JSON)
- created_by
- meaningful_change (boolean)

---

### 4.5 TraceLink

- id
- source_object_id
- target_object_id
- relationship_type

---

### 4.6 Approval

- id
- object_id
- version_id
- approver_id
- status
- invalidated (boolean)

---

### 4.7 Blocker

- id
- project_id
- object_id
- type
- description
- status

---

### 4.8 Override

- id
- project_id
- blocker_ids
- reason
- risk_acknowledgment
- created_by

---

### 4.9 JiraExport

- id
- project_id
- status
- created_issues (JSON)

---

## 5. Core Screens (MVP)

### 5.1 Project Dashboard

- Ready / Not Ready
- Blockers
- Ownership visibility
- Override visibility

---

### 5.2 Intake Page

- Upload documents
- Trigger AI generation

---

### 5.3 Draft Workspace (Primary UI)

- Document-style editing
- Sections:
  - Workflows
  - Requirements
  - Risks

---

### 5.4 Requirement Detail View

- Linked workflow
- Acceptance criteria
- Owner
- Approval status

---

### 5.5 Approval Queue

- Items requiring approval
- Approve / reject / comment

---

### 5.6 Readiness View

- Blockers
- Explanation of Not Ready state

---

### 5.7 Jira Export Page

- Disabled until Ready
- Preview generated tickets
- Export action

---

## 6. Approval Workflow

### Lifecycle

1. Object created (Draft)
2. Owner assigned
3. Stakeholder reviews
4. Approves or rejects

---

### On Change

- New version created
- Relevant approvals invalidated
- Object returns to Draft

---

### Completion Condition

- All required approvals present
- No unresolved blockers

---

## 7. Readiness Logic

### Hard Blockers

- Requirement missing workflow
- Requirement missing acceptance criteria
- Missing required approval

---

### Readiness Rule

```
IF blockers > 0
  → Not Ready
ELSE
  → Ready
```

---

### Override Rule

```
IF blocker overridden by authorized PM
  → treated as resolved BUT visible
```

---

## 8. Phased Roadmap

---

### Phase 1 (0–90 Days) — MVP

Deliver:

- Project intake
- AI draft generation
- Workflow + requirement editing
- Approval system
- Traceability enforcement
- Readiness dashboard
- Override system
- Jira export gating

**Outcome:**
Teams cannot begin development irresponsibly

---

### Phase 2 (90–180 Days) — Expansion

Add:

- Traceability graph UI
- Version diff viewer
- Structured risk system
- Improved AI validation
- Enhanced Jira mapping
- Role customization

**Outcome:**
Stronger governance and usability

---

### Phase 3 (180–360 Days) — Enterprise / Government

Add:

- GovCloud deployment
- IL5/IL6 readiness
- On-prem deployment
- Advanced audit/compliance
- External customer portal

**Outcome:**
Enterprise and government adoption

---

### Phase 4 — Intelligence Layer

Add:

- AI validation (not just generation)
- Risk prediction
- Requirement quality scoring
- Conflict detection
- Cross-project intelligence

**Outcome:**
Decision intelligence platform

---

## 9. Assumptions

- AI reduces manual effort significantly
- Users prefer document-style editing
- Jira is the primary execution tool
- Enforcement must be real (not advisory)
- Only failure-critical elements are gated

---

## 10. Risks

- Overly complex UX reduces adoption
- AI inaccuracies reduce trust
- Overuse of overrides weakens system
- Integration issues create workarounds
- Over-scoping MVP delays delivery

---

## 11. Open Questions

1. Should readiness rules be configurable per customer?
2. How should “meaningful change” be determined?
3. Should Jira integration remain one-way or become bidirectional?
4. How should large-scale projects be managed in UI?
5. What level of AI explainability is required?

---

## 12. Summary

This MVP establishes:

- A **hard gate before development**
- A **traceable, approved requirements baseline**
- A **visible and accountable readiness decision**

If executed correctly, this platform becomes:

> **The control layer that ensures software projects start correctly—or don’t start at all.**
