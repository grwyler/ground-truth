import test from "node:test";
import assert from "node:assert/strict";
import {
  DECISION_OBJECT_STATUSES,
  OWNERSHIP_ERRORS,
  SEEDED_MVP_USERS,
  buildOwnerAssignment,
  buildOwnerAssignmentAuditEvent
} from "../../../packages/domain/src/index.js";
import { createLocalAiGenerationService } from "../../../apps/web/src/main.js";

const pm = SEEDED_MVP_USERS[0];
const assignableOwners = Object.freeze([
  Object.freeze({
    userId: "user-eng-001",
    displayName: "Evan Brooks",
    email: "engineering@example.local",
    role: "engineering_lead"
  })
]);
const decisionObject = Object.freeze({
  object_id: "obj-owner-1",
  project_id: "project-owner",
  type: "requirement",
  title: "Owned requirement",
  current_version: 1,
  status: DECISION_OBJECT_STATUSES.DRAFT,
  owner_id: null,
  priority: "high",
  created_by: "system-ai-assistant",
  created_at: "2026-04-28T12:00:00.000Z",
  updated_at: "2026-04-28T12:00:00.000Z"
});

test("owner assignment sets a project-assigned owner without creating content changes", () => {
  const assignment = buildOwnerAssignment(
    decisionObject,
    { ownerId: "user-eng-001" },
    pm,
    {
      assignableOwners,
      now: new Date("2026-04-28T13:00:00.000Z")
    }
  );

  assert.equal(assignment.ok, true);
  assert.equal(assignment.decisionObject.owner_id, "user-eng-001");
  assert.equal(assignment.previousOwnerId, null);
  assert.equal(assignment.assignedBy, pm.id);
  assert.equal(assignment.decisionObject.current_version, 1);
});

test("owner assignment rejects missing, unassigned, and closed-object owners", () => {
  const missing = buildOwnerAssignment(decisionObject, {}, pm, { assignableOwners });
  const unassigned = buildOwnerAssignment(
    decisionObject,
    { ownerId: "user-exec-viewer-001" },
    pm,
    { assignableOwners }
  );
  const approved = buildOwnerAssignment(
    {
      ...decisionObject,
      status: DECISION_OBJECT_STATUSES.APPROVED
    },
    { ownerId: "user-eng-001" },
    pm,
    { assignableOwners }
  );

  assert.deepEqual(missing.validation.errors, [OWNERSHIP_ERRORS.OWNER_REQUIRED]);
  assert.deepEqual(unassigned.validation.errors, [OWNERSHIP_ERRORS.OWNER_NOT_ASSIGNABLE]);
  assert.deepEqual(approved.validation.errors, [
    OWNERSHIP_ERRORS.STATUS_NOT_ASSIGNABLE
  ]);
});

test("owner assignment audit event records previous and next owners", () => {
  const assignment = buildOwnerAssignment(
    {
      ...decisionObject,
      owner_id: "user-pm-001"
    },
    { ownerId: "user-eng-001" },
    pm,
    {
      assignableOwners,
      now: new Date("2026-04-28T13:00:00.000Z")
    }
  );
  const auditEvent = buildOwnerAssignmentAuditEvent(assignment, pm, {
    idGenerator: () => "audit-owner-test",
    now: new Date("2026-04-28T13:01:00.000Z")
  });

  assert.equal(auditEvent.audit_event_id, "audit-owner-test");
  assert.equal(auditEvent.entity_id, "obj-owner-1");
  assert.equal(auditEvent.details.previous_owner_id, "user-pm-001");
  assert.equal(auditEvent.details.owner_id, "user-eng-001");
});

test("local workspace service assigns owners to draft decision objects", () => {
  const service = createLocalAiGenerationService();
  const created = service.createDecisionObject(
    "project-owner",
    {
      type: "requirement",
      title: "Workspace requirement",
      content: {
        requirement: "The system shall expose owner assignment in the workspace."
      }
    },
    pm
  );
  const assigned = service.assignOwner(
    "project-owner",
    created.decisionObject.objectId,
    "user-eng-001",
    pm
  );

  assert.equal(created.ok, true);
  assert.equal(assigned.ok, true);
  assert.equal(assigned.decisionObject.ownerId, "user-eng-001");
  assert.equal(service.listDecisionObjects("project-owner")[0].ownerId, "user-eng-001");
});
