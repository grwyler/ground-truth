import test from "node:test";
import assert from "node:assert/strict";
import {
  BLOCKER_STATUSES,
  BLOCKER_TYPES,
  buildOverrideAuditEvent,
  buildOverrideRecord
} from "../../../packages/domain/src/index.js";

const project = Object.freeze({
  project_id: "project-override-unit"
});
const pm = Object.freeze({
  id: "user-pm-001",
  role: "program_manager",
  actorType: "human"
});
const engineeringLead = Object.freeze({
  id: "user-eng-001",
  role: "engineering_lead",
  actorType: "human"
});

test("PM can create an immutable override for open blockers", () => {
  const blocker = blockerRecord("blocker-open");
  const result = buildOverrideRecord(
    project,
    [blocker],
    {
      blockerIds: ["blocker-open"],
      reason: "Known source document gap accepted for pilot start.",
      riskAcknowledgment: "PM accepts the risk and will track it visibly."
    },
    pm,
    {
      idGenerator: () => "override-unit-001",
      now: new Date("2026-04-28T12:00:00.000Z")
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.override.override_id, "override-unit-001");
  assert.deepEqual(result.override.blocker_ids, ["blocker-open"]);
  assert.equal(result.override.authorized_by, pm.id);
  assert.equal(result.override.authority_role, "program_manager");
  assert.equal(result.overriddenBlockers[0].status, BLOCKER_STATUSES.OVERRIDDEN);
  assert.equal(result.overriddenBlockers[0].resolved_at, "2026-04-28T12:00:00.000Z");
});

test("override validation requires PM authority, blocker IDs, reason, and risk acknowledgment", () => {
  const result = buildOverrideRecord(
    project,
    [blockerRecord("blocker-open")],
    {
      blockerIds: [],
      reason: " ",
      riskAcknowledgment: ""
    },
    engineeringLead
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.validation.errors, [
    "OVERRIDE_UNAUTHORIZED",
    "OVERRIDE_BLOCKERS_REQUIRED",
    "OVERRIDE_REASON_REQUIRED",
    "OVERRIDE_RISK_ACKNOWLEDGMENT_REQUIRED"
  ]);
});

test("override validation rejects missing or already closed blockers", () => {
  const result = buildOverrideRecord(
    project,
    [{ ...blockerRecord("blocker-closed"), status: BLOCKER_STATUSES.OVERRIDDEN }],
    {
      blockerIds: ["blocker-missing", "blocker-closed"],
      reason: "Proceed under accepted risk.",
      riskAcknowledgment: "Risk remains visible."
    },
    pm
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.validation.errors, [
    "OVERRIDE_BLOCKER_NOT_FOUND",
    "OVERRIDE_BLOCKER_NOT_OPEN"
  ]);
});

test("override audit event records authority, reason, risk, and blocker links", () => {
  const override = buildOverrideRecord(
    project,
    [blockerRecord("blocker-open")],
    {
      blockerIds: ["blocker-open"],
      reason: "Proceed under accepted risk.",
      riskAcknowledgment: "Risk remains visible."
    },
    pm,
    { idGenerator: () => "override-unit-002" }
  ).override;
  const auditEvent = buildOverrideAuditEvent(override, pm, {
    idGenerator: () => "audit-override-unit",
    now: new Date("2026-04-28T12:00:00.000Z")
  });

  assert.equal(auditEvent.audit_event_id, "audit-override-unit");
  assert.equal(auditEvent.event_type, "override");
  assert.equal(auditEvent.entity_id, "override-unit-002");
  assert.deepEqual(auditEvent.details.blocker_ids, ["blocker-open"]);
  assert.equal(auditEvent.details.reason, "Proceed under accepted risk.");
  assert.equal(auditEvent.details.risk_acknowledgment, "Risk remains visible.");
});

function blockerRecord(blockerId) {
  return {
    blocker_id: blockerId,
    project_id: project.project_id,
    object_id: "obj-requirement-override",
    type: BLOCKER_TYPES.MISSING_TRACEABILITY,
    severity: "critical",
    description: "Requirement is missing traceability.",
    status: BLOCKER_STATUSES.OPEN,
    created_at: "2026-04-28T12:00:00.000Z",
    resolved_at: null
  };
}
