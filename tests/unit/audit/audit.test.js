import test from "node:test";
import assert from "node:assert/strict";
import {
  AUDIT_ERRORS,
  AUDIT_EVENT_TYPES,
  isSensitiveAuditEvent,
  requireAuditEvent,
  toAuditEventSummary,
  validateAuditEvent
} from "../../../packages/domain/src/index.js";

test("audit event validation requires immutable event identity and attribution fields", () => {
  const validation = validateAuditEvent({
    audit_event_id: "",
    project_id: "project-audit",
    actor_id: "user-pm-001",
    event_type: "not-a-real-event",
    entity_type: "",
    entity_id: "entity-1",
    timestamp: "",
    details: null,
    immutable_hash: null
  });

  assert.equal(validation.valid, false);
  assert.deepEqual(validation.errors, [
    AUDIT_ERRORS.EVENT_ID_REQUIRED,
    AUDIT_ERRORS.EVENT_TYPE_INVALID,
    AUDIT_ERRORS.ENTITY_TYPE_REQUIRED,
    AUDIT_ERRORS.TIMESTAMP_REQUIRED,
    AUDIT_ERRORS.DETAILS_REQUIRED
  ]);
});

test("sensitive audit events are recognized and summarized for the audit feed", () => {
  const event = {
    audit_event_id: "audit-approval-1",
    project_id: "project-audit",
    actor_id: "user-customer-pm-001",
    event_type: AUDIT_EVENT_TYPES.APPROVE,
    entity_type: "approval",
    entity_id: "approval-1",
    timestamp: "2026-04-28T12:00:00.000Z",
    details: {
      object_id: "obj-req-1",
      version_id: "ver-req-1"
    },
    immutable_hash: null
  };

  assert.equal(isSensitiveAuditEvent(event), true);
  assert.equal(requireAuditEvent(event), event);
  assert.deepEqual(toAuditEventSummary(event), {
    auditEventId: "audit-approval-1",
    projectId: "project-audit",
    actorId: "user-customer-pm-001",
    eventType: AUDIT_EVENT_TYPES.APPROVE,
    entityType: "approval",
    entityId: "approval-1",
    timestamp: "2026-04-28T12:00:00.000Z",
    details: {
      object_id: "obj-req-1",
      version_id: "ver-req-1"
    },
    immutableHash: null
  });
});
