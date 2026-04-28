import test from "node:test";
import assert from "node:assert/strict";
import { createApiServer } from "../../../apps/api/src/server.js";
import { createInMemoryProjectRepository } from "../../../packages/db/src/index.js";
import {
  DECISION_OBJECT_STATUSES,
  DECISION_OBJECT_TYPES,
  TRACE_RELATIONSHIP_TYPES
} from "../../../packages/domain/src/index.js";

const project = {
  project_id: "project-acceptance-api",
  name: "Acceptance API Project",
  description: null,
  customer: null,
  contract_number: null,
  program_name: null,
  status: "draft",
  readiness_status: "not_ready",
  readiness_score: 0,
  created_by: "user-pm-001",
  created_at: "2026-04-28T12:00:00.000Z",
  updated_at: "2026-04-28T12:00:00.000Z"
};
const requirement = decisionObject("obj-requirement-acceptance", DECISION_OBJECT_TYPES.REQUIREMENT);

test("acceptance criteria API creates a Test object with a mandatory trace link", async () => {
  const repository = createRepository();
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/projects/project-acceptance-api/decision-objects/obj-requirement-acceptance/acceptance-criteria`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id": "user-eng-001"
        },
        body: JSON.stringify({
          title: "Reviewable criteria",
          criteria: "Engineering can verify the requirement behavior."
        })
      }
    );
    const result = await response.json();

    assert.equal(response.status, 201);
    assert.equal(result.acceptanceCriteria.title, "Reviewable criteria");
    assert.deepEqual(result.acceptanceCriteria.criteria, [
      "Engineering can verify the requirement behavior."
    ]);
    assert.equal(result.traceLink.relationshipType, TRACE_RELATIONSHIP_TYPES.VALIDATED_BY);
    assert.equal(result.traceLink.requiredForReadiness, true);
    assert.equal(repository.listDecisionObjects("project-acceptance-api").length, 2);
    assert.equal(
      repository.listTraceLinks("project-acceptance-api", "obj-requirement-acceptance").length,
      1
    );
    assert.equal(repository.listAuditEvents("project-acceptance-api").length, 2);
  } finally {
    server.close();
  }
});

test("acceptance criteria API lists criteria and updates them through versioning", async () => {
  const repository = createRepository();
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const createResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-acceptance-api/decision-objects/obj-requirement-acceptance/acceptance-criteria`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id": "user-eng-001"
        },
        body: JSON.stringify({
          title: "Initial criteria",
          criteria: ["Initial behavior is testable."]
        })
      }
    );
    const created = await createResponse.json();

    const updateResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-acceptance-api/decision-objects/${created.acceptanceCriteria.objectId}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-user-id": "user-eng-001"
        },
        body: JSON.stringify({
          content: {
            acceptance_criteria: ["Updated behavior is testable."]
          },
          changeReason: "Clarified acceptance expectation."
        })
      }
    );
    const updated = await updateResponse.json();

    assert.equal(updateResponse.status, 200);
    assert.equal(updated.decisionObject.currentVersion, 2);
    assert.deepEqual(updated.decisionObject.content.acceptance_criteria, [
      "Updated behavior is testable."
    ]);

    const listResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-acceptance-api/decision-objects/obj-requirement-acceptance/acceptance-criteria`,
      {
        headers: { "x-user-id": "user-eng-001" }
      }
    );
    const list = await listResponse.json();

    assert.equal(listResponse.status, 200);
    assert.equal(list.acceptanceCriteria.length, 1);
    assert.equal(list.acceptanceCriteria[0].currentVersion, 2);
    assert.deepEqual(list.acceptanceCriteria[0].criteria, [
      "Updated behavior is testable."
    ]);
  } finally {
    server.close();
  }
});

test("acceptance criteria API rejects empty criteria and unauthorized writes", async () => {
  const repository = createRepository();
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const invalidResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-acceptance-api/decision-objects/obj-requirement-acceptance/acceptance-criteria`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id": "user-eng-001"
        },
        body: JSON.stringify({ criteria: "   " })
      }
    );
    const invalid = await invalidResponse.json();

    assert.equal(invalidResponse.status, 400);
    assert.deepEqual(invalid.details, ["ACCEPTANCE_CRITERIA_REQUIRED"]);

    const unauthorizedResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-acceptance-api/decision-objects/obj-requirement-acceptance/acceptance-criteria`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id": "user-exec-viewer-001"
        },
        body: JSON.stringify({ criteria: "Viewer cannot create this." })
      }
    );
    const unauthorized = await unauthorizedResponse.json();

    assert.equal(unauthorizedResponse.status, 403);
    assert.equal(unauthorized.error, "FORBIDDEN");
  } finally {
    server.close();
  }
});

function createRepository() {
  return createInMemoryProjectRepository({
    projects: [project],
    documents: [],
    aiGenerationJobs: [],
    decisionObjects: [requirement],
    decisionObjectVersions: [versionFor(requirement)],
    traceLinks: [],
    auditEvents: []
  });
}

function decisionObject(objectId, type) {
  return {
    object_id: objectId,
    project_id: "project-acceptance-api",
    type,
    title: objectId,
    current_version: 1,
    status: DECISION_OBJECT_STATUSES.DRAFT,
    owner_id: "user-eng-001",
    priority: "high",
    created_by: "system-ai-assistant",
    created_at: "2026-04-28T12:00:00.000Z",
    updated_at: "2026-04-28T12:00:00.000Z"
  };
}

function versionFor(decisionObjectRecord) {
  return {
    version_id: `ver-${decisionObjectRecord.object_id}`,
    object_id: decisionObjectRecord.object_id,
    version_number: 1,
    content: { requirement: decisionObjectRecord.title },
    change_reason: "Initial test version.",
    changed_by: "system-ai-assistant",
    created_at: "2026-04-28T12:00:00.000Z",
    meaningful_change: true
  };
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.listen(0, () => resolve(server));
    server.on("error", reject);
  });
}

function getBaseUrl(server) {
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}
