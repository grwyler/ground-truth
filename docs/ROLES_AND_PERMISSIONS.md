# Roles and Permissions Matrix

**Pre-Development Readiness Platform**

---

## 1. Role Descriptions

### Program Manager (PM)

Primary project owner responsible for creating projects, assigning ownership, managing readiness progress, resolving blockers, and initiating Ready-to-Build certification.

### Engineering Lead

Responsible for technical feasibility, engineering readiness, and validating that approved requirements can be executed by the development team.

### Systems Engineer

Responsible for architecture, interfaces, traceability, data model alignment, and technical decision integrity.

### Operator Representative

Responsible for validating operator workflows, CONOPS, operational assumptions, and real-world usage scenarios.

### Customer / Government PM

Responsible for reviewing and approving customer-facing requirements, scope alignment, and acceptance expectations.

### Executive / Leadership Viewer

Responsible for oversight, readiness visibility, blocker awareness, and risk/accountability review.

### Admin

Responsible for tenant configuration, user management, integrations, security settings, and platform administration.

### AI Assistant / System

Non-human system actor that generates drafts, identifies risks, suggests missing requirements, and assists with structuring outputs. It cannot approve, override, or own final decisions.

---

## 2. Roles and Permissions Matrix

| Role                          | View Permissions                                                                                     | Create Permissions                                                                                                          | Edit Permissions                                                                                  | Delete Permissions                                                                 | Approval Permissions                                                       | Admin Capabilities                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Program Manager               | View all project artifacts, readiness status, blockers, risks, approvals, overrides, audit summaries | Create projects, upload documents, create decision objects, create risks, create overrides, generate certification packages | Edit project metadata, assign owners, edit draft objects, update risks, manage readiness workflow | Delete draft artifacts where permitted; archive projects if authorized             | Approve PM-owned objects; submit overrides as named authority              | Manage project-level roles, configure project workflow, initiate Jira export |
| Engineering Lead              | View requirements, workflows, technical blockers, readiness dashboard, Jira export preview           | Create technical feasibility notes, engineering risks, acceptance criteria, Jira export mappings                            | Edit technical feasibility inputs, acceptance criteria, engineering-related requirements          | Delete own draft technical inputs where permitted                                  | Approve technical feasibility and engineering readiness                    | None by default                                                              |
| Systems Engineer              | View workflows, requirements, architecture links, interfaces, data objects, traceability graph       | Create architecture objects, interface objects, data objects, traceability links                                            | Edit architecture/interface/data mappings, update traceability links                              | Delete draft architecture/interface/data objects where permitted                   | Approve architecture, interface, and traceability readiness                | None by default                                                              |
| Operator Representative       | View assigned workflows, related requirements, operational assumptions, comments                     | Create workflow edits, edge cases, operational notes                                                                        | Edit assigned workflows and operational validation content                                        | Delete own draft workflow notes where permitted                                    | Approve operator workflows / CONOPS                                        | None                                                                         |
| Customer / Government PM      | View customer-facing workflows, requirements, acceptance criteria, risks, readiness status           | Create comments, change requests, requirement clarification notes                                                           | Edit comments and clarification notes; propose requirement changes                                | Delete own draft comments where permitted                                          | Approve requirement acceptance and customer-facing scope                   | None                                                                         |
| Executive / Leadership Viewer | View readiness dashboard, blockers, risks, overrides, certification package, high-level audit trail  | None by default                                                                                                             | None by default                                                                                   | None                                                                               | None by default; may approve override only if explicitly granted authority | None                                                                         |
| Admin                         | View tenant/project configuration, users, integrations, audit logs, system settings                  | Create users, roles, tenants, integration configs                                                                           | Edit users, roles, tenant settings, integrations, permissions                                     | Disable users, remove integrations, archive tenant/project records where permitted | No content approval by default unless assigned a project role              | Full tenant/platform configuration                                           |
| AI Assistant / System         | Access source materials only within authorized processing scope                                      | Generate draft workflows, requirements, risks, assumptions, missing questions, Jira structures                              | Suggest edits only; may not directly modify approved content without human acceptance             | Cannot delete user content                                                         | Cannot approve, reject, or override                                        | None                                                                         |

---

## 3. Permission Rules

### Approval Rules

- Approvals must be explicit.
- Approvals are tied to a specific object version.
- AI cannot approve.
- Users can only approve objects within their assigned authority.
- Meaningful changes invalidate affected approvals.

### Override Rules

- Overrides require PM or higher authority.
- Overrides must include:
  - named authority
  - reason
  - explicit risk acknowledgment
  - linked blocker(s)
- Overrides must be visible in dashboard and audit trail.

### Deletion Rules

- Approved objects should not be hard-deleted.
- Deletion should generally be limited to draft objects.
- Historical versions, approvals, overrides, and audit logs must be retained.

### Admin Rule

- Admins manage platform configuration.
- Admin status alone does not imply project decision authority unless separately assigned.

---

## 4. Assumptions

- Role permissions are tenant-configurable but follow secure defaults.
- Most project decisions are owned by named users, not generic groups.
- Approval authority depends on both role and object type.
- Executive users primarily need visibility, not editing access.
- AI is treated as an assistive system actor, not an accountable stakeholder.

---

## 5. Risks

- Too many permission distinctions may create administrative burden.
- Overly broad PM permissions could weaken governance.
- Admins may be mistakenly treated as business approvers.
- Customer/Government PM access may require restricted portal behavior.
- Override authority may need stricter controls in high-risk programs.

---

## 6. Open Questions

1. Should overrides require one approver or multi-party approval for high-risk blockers?
2. Should Executive / Leadership users be able to approve overrides by default?
3. Should Customer / Government PM users have direct edit access or comment-only access?
4. Should object-level permissions override project-level permissions?
5. Should approval authority be configurable per project, tenant, or contract?
6. Should deletion be replaced entirely by archive/supersede behavior?
7. Should external users access the same workspace or a separate review portal?
