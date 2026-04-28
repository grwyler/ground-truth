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
  project_id: "project-trace-api",
  name: "Trace API Project",
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
const requirement = decisionObject("obj-requirement-api", DECISION_OBJECT_TYPES.REQUIREMENT);
const workflow = decisionObject("obj-workflow-api", DECISION_OBJECT_TYPES.WORKFLOW);
const testObject = decisionObject("obj-test-api", DECISION_OBJECT_TYPES.TEST);

test("traceability API creates, lists, and deletes requirement links", async () => {
  const repository = createRepository();
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const createResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-trace-api/decision-objects/obj-requirement-api/links`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetObjectId: "obj-workflow-api",
          relationshipType: TRACE_RELATIONSHIP_TYPES.DERIVED_FROM
        })
      }
    );
    const created = await createResponse.json();

    assert.equal(createResponse.status, 201);
    assert.equal(created.traceLink.requiredForReadiness, true);
    assert.equal(created.traceLink.targetTitle, "obj-workflow-api");

    const listResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-trace-api/decision-objects/obj-requirement-api/links`
    );
    const list = await listResponse.json();

    assert.equal(listResponse.status, 200);
    assert.equal(list.traceLinks.length, 1);
    assert.equal(list.traceLinks[0].relationshipType, TRACE_RELATIONSHIP_TYPES.DERIVED_FROM);

    const deleteResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-trace-api/decision-objects/obj-requirement-api/links/${created.traceLink.linkId}`,
      { method: "DELETE" }
    );
    const deleted = await deleteResponse.json();

    assert.equal(deleteResponse.status, 200);
    assert.equal(deleted.traceLink.linkId, created.traceLink.linkId);
    assert.equal(repository.listTraceLinks("project-trace-api", "obj-requirement-api").length, 0);
    assert.equal(repository.listAuditEvents("project-trace-api").length, 2);
  } finally {
    server.close();
  }
});

test("traceability API rejects invalid links and unauthorized writes", async () => {
  const repository = createRepository();
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const invalidResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-trace-api/decision-objects/obj-requirement-api/links`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetObjectId: "obj-test-api",
          relationshipType: TRACE_RELATIONSHIP_TYPES.DERIVED_FROM
        })
      }
    );
    const invalid = await invalidResponse.json();

    assert.equal(invalidResponse.status, 400);
    assert.deepEqual(invalid.details, ["TRACE_INVALID_RELATIONSHIP"]);

    const unauthorizedResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-trace-api/decision-objects/obj-requirement-api/links`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id": "user-exec-viewer-001"
        },
        body: JSON.stringify({
          targetObjectId: "obj-test-api",
          relationshipType: TRACE_RELATIONSHIP_TYPES.VALIDATED_BY
        })
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
    decisionObjects: [requirement, workflow, testObject],
    decisionObjectVersions: [
      versionFor(requirement),
      versionFor(workflow),
      versionFor(testObject)
    ],
    traceLinks: [],
    auditEvents: []
  });
}

function decisionObject(objectId, type) {
  return {
    object_id: objectId,
    project_id: "project-trace-api",
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
    content: { summary: decisionObjectRecord.title },
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
