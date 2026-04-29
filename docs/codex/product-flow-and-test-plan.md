# Product Flow and Test Plan (Current MVP)

Date reviewed: 2026-04-29

This report is intentionally blunt. The question is not “does the UI look like a requirements tool?” It’s “does this product reliably stop a team from starting development until the project is actually ready?”

---

# 1. Current Product Summary

The current MVP is a single-page “project workspace” that lets a user:

- Create projects and upload source documents (PDF/DOCX/TXT).
- Generate a set of draft “decision objects” (Workflows, Requirements, Tests, Risks) from uploaded documents using a local/deterministic draft generator.
- Edit drafts, accept/reject them, and assign an owner per object.
- Add acceptance criteria for requirements (which creates a Test object + trace link).
- Add traceability links between objects (e.g., requirement → workflow, requirement → test).
- Collect approvals for current versions of Workflows and Requirements (with a lightweight approval queue, comments, and a version diff when approvals get invalidated).
- Compute a “Readiness Gate” result (Ready / Not Ready) based on whether each requirement has (1) workflow + test traceability and (2) workflows/requirements have an active approval for the current version (or a recorded override).
- Generate a “Certification Package” preview and a mock Jira export preview, but only when the readiness gate is “Ready” (or blockers are overridden).

What it does **not** do today (core to your original intent):

- It does not reliably force real customer/operator participation; one user can often “paper over” missing involvement.
- It does not cover infrastructure readiness beyond the word “readiness.”
- It does not prevent engineers from starting work outside the tool; it only disables the in-app Jira export UI.

---

# 2. Intended Product Flow (Ideal End-to-End Journey)

Below is the ideal journey for the original mission: **block development until the project is genuinely Ready to Build**.

## A. Create project (intake + definition)
1. Create a project with customer/program metadata.
2. Define the “build context”: target environment, constraints, delivery assumptions, stakeholders, and acceptance authority.
3. Assign required roles (Customer PM, Operator Rep, Engineering Lead, Program Manager, etc.) and lock who can approve what.

## B. Upload source documents (contract reality)
1. Upload the SOW + any existing artifacts (legacy screenshots, SOPs, interface docs, current pain points).
2. Extract and index content (searchable, citeable), and maintain a provenance trail for every derived artifact.

## C. Generate or enter workflows/requirements (workflow-first)
1. Generate initial workflows from the documents and operator interviews.
2. Derive requirements from those workflows (not the other way around).
3. Capture acceptance criteria and operational definition of “done.”
4. Capture key risks/assumptions/unknowns explicitly (with owners).

## D. Review gaps (what’s missing before build)
1. Automatically identify gaps:
   - Missing workflows for key user journeys
   - Requirements not tied to workflows
   - Requirements without acceptance criteria/tests
   - Missing infrastructure readiness items (environments, IAM, data, integrations)
   - Unassigned owners
   - Missing approvals
2. Present a “blockers dashboard” with actionable next steps and explicit ownership.

## E. Approve requirements (real governance)
1. Route approvals to the correct authorities:
   - Operator approves workflows.
   - Customer PM approves requirements/acceptance outcomes.
   - Engineering lead approves testability/feasibility constraints (and infra readiness if appropriate).
2. Prevent “self-approval” loopholes unless explicitly allowed.
3. Record the approval baseline (versions + who approved + when + rationale).

## F. View version changes (control churn)
1. When any approved item changes, invalidate affected approvals.
2. Show diffs clearly (what changed, why, who changed it).
3. Re-route for re-approval and block readiness until re-approved (or explicitly overridden).

## G. Track milestones (readiness milestones, not delivery sprints)
1. Track readiness milestones like:
   - Workflow validation complete
   - Requirements baseline approved
   - Infra dependencies confirmed
   - External integrations validated
   - Risks accepted (if any)
2. Each milestone is “earned” via evidence, not checkbox claims.

## H. Resolve blockers (close the gate properly)
1. Blockers must be resolved via:
   - Creating missing artifacts
   - Completing traceability
   - Assigning owners
   - Securing approvals
   - Completing infrastructure readiness items
2. Overrides exist, but require explicit authority and create a visible risk record.

## I. Reach Ready to Build (hard gate)
1. System declares the project “Ready to Build” only if:
   - Operator workflows are validated
   - Requirements and acceptance criteria are complete and approved
   - Infra readiness is confirmed (or risks accepted)
   - Ownership is assigned for remaining work
   - Known risks are acknowledged
2. The gate should not be a “score”; it should be a **hard yes/no** with auditable reasoning.

## J. Export / handoff to developers (controlled transition)
1. Lock a baseline “Ready-to-Build package” (artifacts + versions + approvals + overrides).
2. Export to execution tools (Jira, Azure DevOps, etc.) only from that baseline.
3. Ensure downstream work intake is blocked unless the readiness gate is open (integration-level enforcement, not only UI-level).

---

# 3. Current Implemented Flow (What The App Actually Supports Today)

The current MVP is a single HTML/JS app (`apps/web/index.html`) with a two-column layout:

- Left: **Project Intake** list + create form.
- Right: **Project Workspace** with multiple stacked panels.

## A. Open the app
1. Open `apps/web/index.html` in a browser.
2. You land on a workspace header showing:
   - Title: “Projects”
   - Subtitle: “Ground Truth MVP workspace for Program Manager” (role is currently fixed to a seeded user).
   - A “role actions” row showing capabilities (e.g., “Manage Project”, “Approve”, “Override”, “Jira Export”) based on that role.

## B. Create a project
In the left column under **Project Intake**:
- Form fields:
  - `Project name` (required)
  - `Customer`
  - `Contract number`
  - `Program`
  - `Description`
- Button: `Create Project`

After creating, a “project card” appears in the same left column:
- Click a project card to open it in the workspace.
- Each project card shows `Status | Readiness` in its subtitle.

## C. Upload source documents
In the right column inside the **Documents** panel:
- Button shown in header: `Generate AI Draft` (note: currently appears unhooked; it is rendered but no click handler is attached).
- Upload form:
  - File picker accepts `.pdf,.docx,.txt` (multiple files).
  - Button: `Upload Documents`
- When no documents exist: message “Upload at least one document before AI draft generation.”
- When documents exist: a list showing `fileName` and `documentType | uploadStatus`.

## D. Generate or enter workflows/requirements
In the right column inside the **AI Draft** panel:
- Button: `Generate Draft` (disabled unless documents exist and role has permission).
- Status line that shows “Generation running.” and then “Generation completed with N draft objects.” (or an error).

Still in **AI Draft**, there is a **Create Decision Object** form:
- Fields:
  - `Type`: Workflow / Requirement / Test / Risk
  - `Title`
  - `Content`
- Button: `Create Object`

## E. Review/edit drafts and create traceability + acceptance criteria
In **AI Draft**, once drafts exist, a **Draft review workspace** appears:

Left side navigation groups:
- Sections: `Workflows`, `Requirements`, `Tests`, `Risks`
- Each item is a clickable card showing `Title` and a meta string like `Suggested | v1 | Ownership needed`.

Right side editor (for the selected draft):
- Editable fields:
  - `Title`
  - `Content`
  - `Change reason`
  - `Owner` (dropdown; disabled unless you have “Manage Project” permission)
- Buttons:
  - `Save Draft`
  - `Accept`
  - `Reject`

Below the editor:
- **Acceptance Criteria** panel (only meaningful for Requirements)
  - Shows “Missing acceptance criteria/test link.” until created.
  - Form fields:
    - `Test title`
    - `Criteria` (textarea)
  - Button: `Add Criteria` (creates a Test object + requirement→test trace link).
- **Traceability** panel (only editable from Requirements)
  - Shows required readiness links:
    - `Workflow link: Linked/Missing`
    - `Acceptance criteria/test link: Linked/Missing`
  - Existing links list, each with a `Remove` button.
  - Add-link form:
    - `Relationship`: Derived from workflow / Validated by test / Depends on / References
    - `Target object` (dropdown)
    - Button: `Add Link`
- A “Draft details” sidebar showing:
  - Owner, Status, Version, Source (document IDs), Required action.

## F. Review gaps (readiness dashboard)
At the top of the project workspace is a **Readiness dashboard**:
- Hero section:
  - Label: “Readiness Gate”
  - Status: `Ready` or `Not Ready`
  - Summary sentence (why).
  - A big score button like `42%` which toggles a “Score breakdown” (hard blockers, resolved/overridden, warnings, rule set version).
- Stats: Hard blockers, Pending approvals, Open risks, Overrides.
- Section: `Active Hard Blockers` with a list of blockers; each blocker has a fix button like `Fix traceability` / `Review approval` / `Open object`.

## G. Approve requirements / workflows
In the **Approval Center** panel:
- Shows queue count like “X pending for your role”.
- Each approval card includes:
  - Title, object type, version, status
  - Content preview
  - A traceability status line
  - An invalidation notice (if a prior approval was invalidated)
  - A “Changes from vX to vY” diff section (if applicable)
  - Comment box
  - Buttons: `Approve`, `Request Changes`, `Reject`
- A small approval history list may appear at the bottom.

Important nuance: approvals are “for your role,” but the app currently runs as a single seeded user (no user switching UI). This makes the approval workflow behave more like “single-user approval simulation.”

## H. Resolve blockers via overrides (risk acceptance)
In the Readiness dashboard `Overrides` section:
- Shows a list of overrides (if any).
- If you have override permissions and there are hard blockers, you also see a **Risk Acceptance** form:
  - A checkbox list of blockers
  - `Reason`
  - `Risk acknowledgment`
  - Checkbox: “I am submitting as [role].”
  - Button: `Submit Override`

Overrides turn a blocker into “overridden,” allowing the project to become Ready even if the underlying gap still exists.

## I. Reach Ready to Build and export
When the Readiness Gate becomes `Ready`:
- **Certification Package** panel enables `Generate Package`.
- **Jira Export** panel enables `Export Preview` (a mock Jira adapter generates preview issues and local “created issues”).

This is the MVP’s closest approximation of a “hard gate,” but it only gates:
- Certification package generation
- Jira export preview

It does not gate anything outside this app (and the Jira integration is currently mocked).

---

# 4. Gap Analysis (Intended vs Implemented)

| Intended capability | Current support | Missing pieces | Importance | Recommendation |
|---|---|---|---|---|
| Hard “Ready to Build” gate that blocks development | Partial | Only disables in-app export; no enforcement in real execution systems | Critical | Make “Ready-to-Build baseline” the only exportable state and enforce via real Jira integration + policy (webhook/automation) |
| Workflow-first requirements derivation | Partial | Objects exist, but no explicit workflow-first flow or guardrails | High | Make workflows a required first-class step; block requirements approval until linked workflows exist |
| Real stakeholder involvement (operator + customer) | Weak | Role model exists, but UI runs as one seeded user | Critical | Add real auth + per-role sessions; require approvals from distinct roles (no self-approval) |
| Clear approval ownership and routing | Partial | Approval queue + required role mapping exist | High | Implement explicit “request approval”/status transitions + notifications; remove ownership loophole for bypassing required approver role |
| Infrastructure readiness as first-class gate | Missing | No infra readiness artifacts, checks, or blockers | Critical | Add infra readiness decision objects/checklists that become hard blockers (environments, IAM, data, integrations) |
| Provenance (“why do we believe this requirement?”) | Partial | Documents can be uploaded; draft overlay shows “Source document IDs” but is sparse | High | Add citations/quotes per requirement/workflow and a source viewer/search |
| Gap detection beyond traceability/approval | Weak | Only checks workflow+test trace links + approvals | High | Add blockers for missing owners, open critical risks, missing infra readiness, missing NFRs, etc. |
| Baseline versioning + change control | Partial | Decision objects are versioned; approvals can be invalidated; diffs shown in approvals | High | Add an explicit “baseline snapshot” concept and a “changes since baseline” view for leadership |
| Milestone tracking toward readiness | Missing | No milestone model/UI | Medium | Add a small set of readiness milestones driven by evidence, not manual toggles |
| Blocker ownership + escalation | Partial | Owners exist per object; blockers show “Owner: …” | Medium | Add blocker assignment + due dates + escalation rules; show “next action” per blocker |
| Export/handoff package for developers | Partial | Certification package preview exists (local URI); Jira export mock exists | High | Produce a structured export bundle (requirements/workflows/tests/trace) + real Jira mapping + locked baseline reference |
| Audit trail suitable for gov delivery | Partial | “Audit Activity” exists but limited and local | Medium | Persist audit events; include immutable baseline hash/signature + evidence attachments |
| Preventing “requirements theater” | Weak | It’s possible to satisfy the readiness rules with minimal substance | Critical | Add quality gates: minimum workflow detail, acceptance criteria quality checks, mandatory operator/customer confirmations |

---

# 5. How to Test the MVP Manually (Scenario Script)

Scenario: A government customer provides a vague SOW:

> “Recreate the legacy tasking system in the cloud using modern technology.”

Goal: convert that into validated workflows, requirements, acceptance criteria, readiness/approvals, and a Ready/Not Ready decision.

Notes:
- This script assumes you are running the MVP as-is (single seeded user role shown in header).
- The MVP is local/in-memory. Refreshing the page may reset state depending on how you run it.

## Test Steps

### Step 1 — Launch the app
- Action: Open `apps/web/index.html` in a browser.
- Expected result: You see the “Projects” workspace with a header describing the current role.
- What failure would indicate: The MVP isn’t runnable as a standalone demo (packaging/build issues).

### Step 2 — Create a new project for the SOW
- Action: In “Project Intake”, fill `Project name` with `Legacy Tasking System Modernization`, optionally set customer/program/contract, click `Create Project`.
- Expected result: A new project card appears; the workspace shows the project name and a readiness status of Not Ready with 0% score.
- What failure would indicate: Project state isn’t created/selected correctly; readiness evaluation isn’t being calculated.

### Step 3 — Upload the vague SOW as a source document
- Action: In the “Documents” panel, upload a `.txt` file containing the SOW sentence, click `Upload Documents`.
- Expected result: The document appears in the list; the “AI Draft” panel’s `Generate Draft` should become enabled.
- What failure would indicate: Document validation is failing unexpectedly; file upload handling is broken.

### Step 4 — Generate initial drafts
- Action: In “AI Draft”, click `Generate Draft`.
- Expected result: Status shows “Generation running.” then “Generation completed with N draft objects.” Drafts appear in the left nav under Workflows/Requirements/Tests/Risks.
- What failure would indicate: Draft generation pipeline is broken; documents aren’t being read; the deterministic adapter isn’t returning objects.

### Step 5 — Validate workflows are not junk
- Action: Click each item under `Workflows`; read/edit `Content`; add a meaningful workflow narrative (actors, triggers, steps, exceptions).
- Expected result: You can `Save Draft`; version increments (overlay shows `v2`, `v3`, etc.).
- What failure would indicate: Draft updates don’t version correctly; content editing doesn’t persist.

### Step 6 — Convert vague “modern tech” into explicit requirements
- Action: Click each `Requirement` draft and rewrite it into testable statements (e.g., role-based access, audit logging, task creation, assignment, status transitions, search/filter, SLAs).
- Expected result: You can `Save Draft` with a `Change reason` describing why the requirement changed.
- What failure would indicate: Requirement content isn’t editable or drafts can’t be saved reliably.

### Step 7 — Create acceptance criteria for each requirement
- Action: For each Requirement, in the “Acceptance Criteria” panel, enter `Test title` + bullet-style criteria in the `Criteria` box, then click `Add Criteria`.
- Expected result: The acceptance criteria list populates; a new Test object appears under `Tests`; traceability requirement→test becomes “Linked.”
- What failure would indicate: Acceptance criteria aren’t creating tests/links; readiness rules can’t be satisfied.

### Step 8 — Link each requirement to a workflow
- Action: For each Requirement, in “Traceability”, use the add-link form:
  - Relationship: `Derived from workflow`
  - Target object: select the relevant Workflow
  - Click `Add Link`
- Expected result: “Workflow link” flips to `Linked`.
- What failure would indicate: Trace link creation is broken; readiness will remain blocked by missing traceability.

### Step 9 — Observe readiness blockers are now mostly approvals
- Action: Scroll to “Readiness dashboard” → “Active Hard Blockers”.
- Expected result: The remaining blockers should mostly be “missing required approval for the current version” (and any requirements still missing links/criteria).
- What failure would indicate: Readiness engine is not aligned with the UI operations, or blockers aren’t updating after changes.

### Step 10 — Approve workflows/requirements (simulated)
- Action: In “Approval Center”, open each approval card and click `Approve`.
- Expected result: Pending approvals count decreases; blockers resolve; readiness score increases.
- What failure would indicate: Approval decisions aren’t being applied; approvals are not tied to current versions.

### Step 11 — Make a change after approval and confirm invalidation
- Action: Edit an already-approved Requirement, add a `Change reason`, click `Save Draft`.
- Expected result: The previous approval becomes invalidated; the approval card should show a diff (“Changes from vX to vY”).
- What failure would indicate: Change control doesn’t work; the system can’t prevent post-approval churn.

### Step 12 — Reach “Ready” legitimately (no override)
- Action: Re-approve anything invalidated; ensure every Requirement shows workflow/test traceability and Workflows/Requirements are approved at current version.
- Expected result: Readiness Gate becomes `Ready` and summary states there are no unresolved hard blockers.
- What failure would indicate: The readiness rules are inconsistent or the UI cannot drive the project to Ready.

### Step 13 — Test the override path (risk acceptance)
- Action: Intentionally leave one blocker open; in “Overrides” use “Risk Acceptance” to submit an override with a clear reason + risk acknowledgment.
- Expected result: The overridden blocker moves out of “open”; readiness may flip to `Ready` even though the underlying issue remains.
- What failure would indicate: Override mechanism is broken (or worse: overrides don’t actually affect readiness and the gate can’t be opened).

### Step 14 — Generate certification package preview
- Action: In “Certification Package”, click `Generate Package`.
- Expected result: A package entry appears with an ID and a URI (local placeholder).
- What failure would indicate: Certification package generation is not gated correctly or fails to reflect the current baseline.

### Step 15 — Jira export preview gating
- Action: In “Jira Export”, enter a `Jira project key` and click `Export Preview`.
- Expected result: Preview issues list appears; “created issues” count updates (mock adapter).
- What failure would indicate: Export is not gated by readiness; preview generation is broken.

---

# 6. Core Product Assumptions (Implied By The Current MVP)

1. **Readiness can be computed from a small ruleset** (traceability + approvals) and represent “go/no-go.”
2. **Workflows + tests are the minimum proof** that requirements are understood and buildable.
3. **Approvals are a sufficient proxy for alignment**, even without enforced distinct stakeholders.
4. **Overrides are acceptable** and can legitimately open the gate if risk is documented.
5. **A certification package and Jira export are the enforcement mechanisms** (even though the integration is currently mocked).
6. **A single workspace experience is enough** (no explicit multi-user collaboration UI exists yet).

---

# 7. Risks of Drifting From Original Intent

These are the biggest “drift” risks visible in the MVP:

1. **Readiness turns into paperwork theater.** The rule set is easy to satisfy without proving operator reality, infrastructure readiness, or true acceptance authority.
2. **Single-user simulation undermines the mission.** If one person can generate, edit, approve, override, and export, the tool becomes a fancy doc editor—exactly what your intent was to avoid.
3. **The product may over-index on Jira export as “the gate.”** If the only enforcement is “you can’t export,” teams will bypass by creating tickets manually.
4. **Infra readiness is currently absent, but the product name/UX implies it’s covered.** That’s a credibility killer with real programs.
5. **Ownership can become a loophole.** In the current domain model, an owner can approve an object even if their role is not the required approver role; this is a fast path to false readiness.
6. **Complexity without leverage.** Certification packages, diffs, audit trail, and traceability are valuable—only if they force better decisions. Otherwise they become “enterprise garnish.”

---

# 8. Recommended Next Development Tasks (Next 10, Priority Order)

These are implementation tasks (not new “big features”) aimed at restoring the original intent: enforce readiness before build.

## 1) Add real user/session switching (or authentication stub)
- Why it matters: Without distinct actors, approvals are meaningless.
- Acceptance criteria:
  - User can switch between at least: Program Manager, Operator Rep, Customer PM, Engineering Lead, Executive Viewer.
  - UI clearly shows “You are acting as …” and changes permissions/queues accordingly.
- Manual test:
  - Create a project as PM, generate drafts, then switch to Operator Rep and confirm workflow approvals appear and requirement approvals do not.

## 2) Enforce “required approver role” (no owner bypass by default)
- Why it matters: Owners approving their own work collapses the gate.
- Acceptance criteria:
  - For Workflow and Requirement approvals, only the required approver role can approve (configurable later, but strict by default).
  - Attempts by other roles are rejected with a clear message.
- Manual test:
  - As PM, try to approve a Workflow; expect denial unless acting as Operator Rep.

## 3) Make “Ready-to-Build baseline” an explicit, frozen snapshot
- Why it matters: Developers need a stable baseline; leadership needs auditability.
- Acceptance criteria:
  - When readiness becomes Ready, user can create a “Baseline v1” snapshot.
  - Baseline records object IDs + versions + approvals + overrides at that moment.
- Manual test:
  - Create baseline; edit a requirement afterward; verify baseline remains unchanged and is shown as “drifted.”

## 4) Add “Changes since baseline” view (project-level drift)
- Why it matters: Prevent silent scope creep after approval.
- Acceptance criteria:
  - A project view lists all objects changed since baseline and whether approvals are invalidated.
- Manual test:
  - Modify one approved requirement; confirm it appears in “changes since baseline” and readiness flips back to Not Ready.

## 5) Add infrastructure readiness as a required decision domain
- Why it matters: Your original problem includes “incomplete infrastructure readiness.”
- Acceptance criteria:
  - Infra readiness items exist (even as a simple structured list) and can create hard blockers.
  - Readiness gate stays Not Ready if required infra items are missing.
- Manual test:
  - Confirm project cannot reach Ready until “environment access, IAM, data sources, integrations” items are confirmed or overridden.

## 6) Add explicit “operator workflow validation” checkpoint
- Why it matters: Workflow-first is the differentiator; operator buy-in is the point.
- Acceptance criteria:
  - Workflows require operator validation approval before requirements can be approved.
- Manual test:
  - Try to approve requirements while workflow approvals are pending; expect the system to block or warn loudly.

## 7) Improve document provenance: quote/citation attachment to objects
- Why it matters: Prevent hallucinated requirements and enable auditability.
- Acceptance criteria:
  - Each workflow/requirement can reference specific document excerpts (even a simple “source quote + doc ID”).
  - Readiness requires at least one source reference for each requirement (configurable threshold).
- Manual test:
  - Create a requirement without a source reference; verify it creates a hard blocker.

## 8) Add “blocker ownership + next action” (not just “exists”)
- Why it matters: Blockers should drive behavior, not just report status.
- Acceptance criteria:
  - Each blocker has an owner, due date (optional), and suggested next step link.
- Manual test:
  - Create missing traceability; verify blocker shows “Assign owner” and cannot be ignored without override.

## 9) Tighten override controls (authority + visibility)
- Why it matters: Overrides are necessary but can destroy the gate if too easy.
- Acceptance criteria:
  - Overrides require a specific authority role (or multi-approval) depending on severity/type.
  - Overrides are prominently displayed as “Risk Accepted” with clear rationale.
- Manual test:
  - As Operator Rep, attempt to override missing customer approval; expect denial.

## 10) Replace the readiness “score” with a strict “gate + reasons”
- Why it matters: Scores invite gaming; gates force decisions.
- Acceptance criteria:
  - UI emphasizes “Ready / Not Ready” with enumerated blockers and required actions.
  - Score becomes secondary or removed in MVP mode.
- Manual test:
  - Create a project with one missing approval; verify it is plainly Not Ready regardless of other progress.

---

# 9. Simplified MVP Definition (Smallest Proof of the Original Idea)

The smallest version that proves the idea is:

1. **Project intake** with required stakeholders assigned (Customer PM + Operator Rep + Engineering Lead + PM).
2. **Workflows** captured and approved by Operator Rep.
3. **Requirements** derived from workflows, each:
   - linked to at least one workflow
   - has acceptance criteria
   - is approved by Customer PM
4. **Infrastructure readiness checklist** (small but real), each item either:
   - confirmed with evidence, or
   - explicitly overridden with risk acceptance by the correct authority
5. **Hard gate**: the system exports nothing and declares “Not Ready” until all blockers are closed.
6. **Baseline snapshot** created when Ready; any changes invalidate approvals and re-close the gate.

If the product cannot enforce those six things, it’s not solving the contract failure problem—it’s just documenting it.

---

# 10. Questions for Product Owner (To Realign the Product)

1. What exactly counts as “development has started” for enforcement purposes (Jira tickets created, PRs opened, sprint planning, code merged)?
2. Which approvals are truly mandatory to open the gate (operator workflows, customer requirements, engineering feasibility, security, infra)?
3. Are overrides allowed for *any* blocker type, or only a subset? Which ones should be non-overridable?
4. Should “owner can approve” ever be allowed, or must approvals always come from specific independent roles?
5. What is the minimum “infrastructure readiness” list you care about for the MVP (cloud account, IAM, networking, data, external integrations, environments, CI/CD)?
6. Do you want workflow-first to be enforced as a hard rule (requirements cannot be approved without workflow linkage), or is it guidance?
7. What evidence is required to mark a workflow “validated” (operator sign-off only, or demo/prototype, or screenshots, or joint workshop notes)?
8. How do you want to handle “unknowns” (unknown integration details, unknown data quality): are they blockers by default, risks, or allowed if tracked?
9. Who is the final “Ready to Build” authority—one role, or a composite of required approvals?
10. What would make you say “this MVP proves it works” after one real pilot project?

