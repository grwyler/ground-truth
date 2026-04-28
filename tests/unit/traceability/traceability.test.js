import test from "node:test";
import assert from "node:assert/strict";
import {
  DECISION_OBJECT_TYPES,
  SEEDED_MVP_USERS,
  TRACEABILITY_ERRORS,
  TRACE_RELATIONSHIP_TYPES,
  buildTraceLinkAuditEvent,
  buildTraceLinkCreate
} from "../../../packages/domain/src/index.js";
import { createLocalAiGenerationService } from "../../../apps/web/src/main.js";

const pm = SEEDED_MVP_USERS[0];
const workflow = decisionObject("obj-workflow", DECISION_OBJECT_TYPES.WORKFLOW);
const requirement = decisionObject("obj-requirement", DECISION_OBJECT_TYPES.REQUIREMENT);
const testObject = decisionObject("obj-test", DECISION_OBJECT_TYPES.TEST);
const risk = decisionObject("obj-risk", DECISION_OBJECT_TYPES.RISK);

test("traceability creates required requirement-to-workflow links", () => {
  const result = buildTraceLinkCreate(
    requirement,
    workflow,
    { relationshipType: TRACE_RELATIONSHIP_TYPES.DERIVED_FROM },
    pm,
    {
      idGenerator: () => "link-requirement-workflow",
      now: new Date("2026-04-28T13:00:00.000Z")
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.traceLink.link_id, "link-requirement-workflow");
  assert.equal(result.traceLink.source_object_id, requirement.object_id);
  assert.equal(result.traceLink.target_object_id, workflow.object_id);
  assert.equal(result.traceLink.required_for_readiness, true);
});

test("traceability creates required requirement-to-test links", () => {
  const result = buildTraceLinkCreate(
    requirement,
    testObject,
    { relationshipType: TRACE_RELATIONSHIP_TYPES.VALIDATED_BY },
    pm
  );

  assert.equal(result.ok, true);
  assert.equal(result.traceLink.required_for_readiness, true);
});

test("traceability rejects invalid mandatory relationship combinations", () => {
  const result = buildTraceLinkCreate(
    risk,
    workflow,
    { relationshipType: TRACE_RELATIONSHIP_TYPES.DERIVED_FROM },
    pm
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.validation.errors, [TRACEABILITY_ERRORS.INVALID_RELATIONSHIP]);
});

test("traceability rejects unsupported relationship types and self links", () => {
  const unsupported = buildTraceLinkCreate(
    requirement,
    workflow,
    { relationshipType: TRACE_RELATIONSHIP_TYPES.BLOCKS },
    pm
  );
  const selfLink = buildTraceLinkCreate(
    requirement,
    requirement,
    { relationshipType: TRACE_RELATIONSHIP_TYPES.REFERENCES },
    pm
  );

  assert.deepEqual(unsupported.validation.errors, [
    TRACEABILITY_ERRORS.RELATIONSHIP_NOT_SUPPORTED
  ]);
  assert.deepEqual(selfLink.validation.errors, [TRACEABILITY_ERRORS.SELF_LINK]);
});

test("traceability audit event records create and delete context", () => {
  const result = buildTraceLinkCreate(
    requirement,
    workflow,
    { relationshipType: TRACE_RELATIONSHIP_TYPES.DERIVED_FROM },
    pm,
    { idGenerator: () => "link-audit" }
  );
  const auditEvent = buildTraceLinkAuditEvent(result.traceLink, pm, "deleted", {
    idGenerator: () => "audit-trace-delete",
    now: new Date("2026-04-28T13:05:00.000Z")
  });

  assert.equal(auditEvent.audit_event_id, "audit-trace-delete");
  assert.equal(auditEvent.entity_type, "trace_link");
  assert.equal(auditEvent.details.action, "deleted");
  assert.equal(auditEvent.details.relationship_type, TRACE_RELATIONSHIP_TYPES.DERIVED_FROM);
});

test("local workspace service persists requirement trace links", () => {
  const service = createLocalAiGenerationService();
  const createdRequirement = service.createDecisionObject(
    "project-traceability",
    {
      type: DECISION_OBJECT_TYPES.REQUIREMENT,
      title: "Workspace requirement",
      content: { requirement: "The platform shall persist trace links." }
    },
    pm
  );
  const createdWorkflow = service.createDecisionObject(
    "project-traceability",
    {
      type: DECISION_OBJECT_TYPES.WORKFLOW,
      title: "Workspace workflow",
      content: { summary: "Operator completes the workflow." }
    },
    pm
  );
  const linked = service.createTraceLink(
    "project-traceability",
    createdRequirement.decisionObject.objectId,
    {
      targetObjectId: createdWorkflow.decisionObject.objectId,
      relationshipType: TRACE_RELATIONSHIP_TYPES.DERIVED_FROM
    },
    pm
  );

  assert.equal(linked.ok, true);
  assert.equal(
    service.listTraceLinks("project-traceability", createdRequirement.decisionObject.objectId)
      .length,
    1
  );

  const deleted = service.deleteTraceLink(
    "project-traceability",
    createdRequirement.decisionObject.objectId,
    linked.traceLink.linkId
  );

  assert.equal(deleted.ok, true);
  assert.equal(
    service.listTraceLinks("project-traceability", createdRequirement.decisionObject.objectId)
      .length,
    0
  );
});

function decisionObject(objectId, type) {
  return Object.freeze({
    object_id: objectId,
    project_id: "project-traceability",
    type,
    title: objectId,
    current_version: 1,
    status: "draft",
    owner_id: "user-eng-001",
    priority: "high",
    created_by: "system-ai-assistant",
    created_at: "2026-04-28T12:00:00.000Z",
    updated_at: "2026-04-28T12:00:00.000Z"
  });
}
