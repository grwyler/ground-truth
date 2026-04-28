import test from "node:test";
import assert from "node:assert/strict";
import {
  ACCEPTANCE_CRITERIA_ERRORS,
  DECISION_OBJECT_STATUSES,
  DECISION_OBJECT_TYPES,
  SEEDED_MVP_USERS,
  TRACE_RELATIONSHIP_TYPES,
  buildAcceptanceCriteriaCreate
} from "../../../packages/domain/src/index.js";
import { createLocalAiGenerationService } from "../../../apps/web/src/main.js";

const engineeringLead = SEEDED_MVP_USERS.find((user) => user.id === "user-eng-001");
const requirement = {
  object_id: "obj-acceptance-requirement",
  project_id: "project-acceptance",
  type: DECISION_OBJECT_TYPES.REQUIREMENT,
  title: "Field intake requirement",
  current_version: 1,
  status: DECISION_OBJECT_STATUSES.DRAFT,
  owner_id: "user-eng-001",
  priority: "high",
  created_by: "system-ai-assistant",
  created_at: "2026-04-28T12:00:00.000Z",
  updated_at: "2026-04-28T12:00:00.000Z"
};

test("acceptance criteria creation creates a Test object and required validation link", () => {
  const result = buildAcceptanceCriteriaCreate(
    requirement,
    {
      title: "Photo metadata acceptance",
      criteria: "Photo metadata is visible to reviewers."
    },
    engineeringLead,
    {
      idGenerator: (kind) => `acceptance-${kind}`,
      now: new Date("2026-04-28T13:00:00.000Z")
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.decisionObject.type, DECISION_OBJECT_TYPES.TEST);
  assert.equal(result.decisionObject.owner_id, requirement.owner_id);
  assert.deepEqual(result.version.content.acceptance_criteria, [
    "Photo metadata is visible to reviewers."
  ]);
  assert.equal(result.traceLink.source_object_id, requirement.object_id);
  assert.equal(result.traceLink.target_object_id, result.decisionObject.object_id);
  assert.equal(result.traceLink.relationship_type, TRACE_RELATIONSHIP_TYPES.VALIDATED_BY);
  assert.equal(result.traceLink.required_for_readiness, true);
});

test("acceptance criteria creation rejects empty criteria and non-requirement anchors", () => {
  const empty = buildAcceptanceCriteriaCreate(requirement, { criteria: "   " }, engineeringLead);
  const wrongType = buildAcceptanceCriteriaCreate(
    { ...requirement, type: DECISION_OBJECT_TYPES.WORKFLOW },
    { criteria: "Workflow cannot own this criteria." },
    engineeringLead
  );

  assert.deepEqual(empty.validation.errors, [
    ACCEPTANCE_CRITERIA_ERRORS.CRITERIA_REQUIRED
  ]);
  assert.deepEqual(wrongType.validation.errors, [
    ACCEPTANCE_CRITERIA_ERRORS.INVALID_REQUIREMENT_TYPE
  ]);
});

test("local workspace creates criteria and clears missing test traceability", () => {
  const service = createLocalAiGenerationService();
  const createdRequirement = service.createDecisionObject(
    "project-acceptance-local",
    {
      type: DECISION_OBJECT_TYPES.REQUIREMENT,
      title: "Local requirement",
      content: { requirement: "The system shall show reviewer-ready criteria." }
    },
    engineeringLead
  );

  assert.equal(
    service.listAcceptanceCriteria(
      "project-acceptance-local",
      createdRequirement.decisionObject.objectId
    ).length,
    0
  );

  const createdCriteria = service.createAcceptanceCriteria(
    "project-acceptance-local",
    createdRequirement.decisionObject.objectId,
    {
      title: "Reviewer criteria",
      criteria: "Reviewer can verify the saved criteria."
    },
    engineeringLead
  );

  assert.equal(createdCriteria.ok, true);
  assert.equal(createdCriteria.acceptanceCriteria.currentVersion, 1);
  assert.equal(
    service.listAcceptanceCriteria(
      "project-acceptance-local",
      createdRequirement.decisionObject.objectId
    ).length,
    1
  );
  assert.equal(
    service.listTraceLinks(
      "project-acceptance-local",
      createdRequirement.decisionObject.objectId
    )[0].relationshipType,
    TRACE_RELATIONSHIP_TYPES.VALIDATED_BY
  );
});
