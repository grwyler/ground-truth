import test from "node:test";
import assert from "node:assert/strict";
import { createApiServer } from "../../../apps/api/src/server.js";
import { createInMemoryProjectRepository } from "../../../packages/db/src/index.js";
import {
  DRAFT_REVIEW_STATUSES,
  DECISION_OBJECT_STATUSES
} from "../../../packages/domain/src/index.js";

const project = {
  project_id: "project-draft-api",
  name: "Draft API Project",
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
const decisionObject = {
  object_id: "obj-draft-api",
  project_id: "project-draft-api",
  type: "requirement",
  title: "Generated API requirement",
  current_version: 1,
  status: DECISION_OBJECT_STATUSES.DRAFT,
  owner_id: null,
  priority: "high",
  created_by: "system-ai-assistant",
  created_at: "2026-04-28T12:00:00.000Z",
  updated_at: "2026-04-28T12:00:00.000Z"
};
const version = {
  version_id: "ver-draft-api",
  object_id: "obj-draft-api",
  version_number: 1,
  content: {
    requirement: "Generated API requirement text.",
    acceptance_criteria: ["Human reviewer can edit the draft"],
    ai_generated: true,
    source_document_ids: ["doc-api-1"]
  },
  change_reason: "Initial AI-generated draft candidate.",
  changed_by: "system-ai-assistant",
  created_at: "2026-04-28T12:00:00.000Z",
  meaningful_change: true
};

test("decision object API lists, edits, and accepts draft objects", async () => {
  const repository = createRepository();
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const listResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-draft-api/decision-objects`
    );
    const list = await listResponse.json();

    assert.equal(listResponse.status, 200);
    assert.equal(list.decisionObjects.length, 1);
    assert.equal(list.decisionObjects[0].content.ai_generated, true);

    const editResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-draft-api/decision-objects/obj-draft-api`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Reviewed API requirement",
          content: {
            requirement: "Reviewed API requirement text."
          }
        })
      }
    );
    const edit = await editResponse.json();

    assert.equal(editResponse.status, 200);
    assert.equal(edit.decisionObject.title, "Reviewed API requirement");
    assert.equal(edit.decisionObject.currentVersion, 2);
    assert.equal(edit.decisionObject.content.requirement, "Reviewed API requirement text.");

    const versionsResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-draft-api/decision-objects/obj-draft-api/versions`
    );
    const versions = await versionsResponse.json();

    assert.equal(versionsResponse.status, 200);
    assert.equal(versions.versions.length, 2);
    assert.equal(versions.versions[0].content.requirement, "Generated API requirement text.");
    assert.equal(versions.versions[1].versionNumber, 2);

    const acceptResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-draft-api/decision-objects/obj-draft-api/accept`,
      {
        method: "POST"
      }
    );
    const accepted = await acceptResponse.json();

    assert.equal(acceptResponse.status, 200);
    assert.equal(accepted.decisionObject.status, DECISION_OBJECT_STATUSES.DRAFT);
    assert.equal(
      accepted.decisionObject.content.ai_review_status,
      DRAFT_REVIEW_STATUSES.ACCEPTED
    );
    assert.equal(repository.listAuditEvents("project-draft-api").length, 2);
  } finally {
    server.close();
  }
});

test("decision object API rejects drafts and reports readiness exclusion", async () => {
  const repository = createRepository();
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/projects/project-draft-api/decision-objects/obj-draft-api/reject`,
      {
        method: "POST"
      }
    );
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.excludedFromReadiness, true);
    assert.equal(result.decisionObject.status, DECISION_OBJECT_STATUSES.REJECTED);
    assert.equal(
      result.decisionObject.content.ai_review_status,
      DRAFT_REVIEW_STATUSES.REJECTED
    );
  } finally {
    server.close();
  }
});

test("decision object API creates objects and skips versions for metadata-only edits", async () => {
  const repository = createRepository();
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const createResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-draft-api/decision-objects`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "risk",
          title: "Coverage risk",
          content: {
            risk: "Remote sites may have unstable coverage."
          },
          ownerId: "user-pm-001",
          priority: "high"
        })
      }
    );
    const created = await createResponse.json();

    assert.equal(createResponse.status, 201);
    assert.equal(created.decisionObject.currentVersion, 1);
    assert.equal(created.decisionObject.type, "risk");

    const updateResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-draft-api/decision-objects/${created.decisionObject.objectId}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ownerId: "user-eng-001",
          priority: "medium"
        })
      }
    );
    const updated = await updateResponse.json();

    assert.equal(updateResponse.status, 200);
    assert.equal(updated.decisionObject.currentVersion, 1);
    assert.equal(updated.decisionObject.ownerId, "user-eng-001");

    const versionsResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-draft-api/decision-objects/${created.decisionObject.objectId}/versions`
    );
    const versions = await versionsResponse.json();

    assert.equal(versions.versions.length, 1);
  } finally {
    server.close();
  }
});

test("decision object API requires change reason once approvals exist", async () => {
  const repository = createInMemoryProjectRepository({
    projects: [project],
    documents: [],
    aiGenerationJobs: [],
    decisionObjects: [decisionObject],
    decisionObjectVersions: [version],
    approvals: [
      {
        approval_id: "approval-draft-api",
        object_id: decisionObject.object_id,
        version_id: version.version_id,
        approver_id: "user-customer-pm-001",
        decision: "approved",
        comment: null,
        status: "active",
        created_at: "2026-04-28T12:00:00.000Z",
        invalidated_at: null,
        invalidation_reason: null
      }
    ],
    auditEvents: []
  });
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/projects/project-draft-api/decision-objects/obj-draft-api`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: {
            requirement: "Changed without reason."
          }
        })
      }
    );
    const result = await response.json();

    assert.equal(response.status, 400);
    assert.equal(result.error, "VALIDATION_ERROR");
    assert.deepEqual(result.details, ["DECISION_OBJECT_CHANGE_REASON_REQUIRED"]);
  } finally {
    server.close();
  }
});

test("decision object API invalidates approvals and returns version diff", async () => {
  const repository = createInMemoryProjectRepository({
    projects: [project],
    documents: [],
    aiGenerationJobs: [],
    decisionObjects: [
      {
        ...decisionObject,
        status: DECISION_OBJECT_STATUSES.APPROVED
      }
    ],
    decisionObjectVersions: [version],
    approvals: [
      {
        approval_id: "approval-draft-api",
        object_id: decisionObject.object_id,
        version_id: version.version_id,
        approver_id: "user-customer-pm-001",
        decision: "approved",
        comment: "Approved for baseline.",
        status: "active",
        created_at: "2026-04-28T12:00:00.000Z",
        invalidated_at: null,
        invalidation_reason: null
      }
    ],
    auditEvents: []
  });
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const updateResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-draft-api/decision-objects/obj-draft-api`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: {
            requirement: "Reviewed API requirement text with timestamp evidence."
          },
          changeReason: "Clarified evidence requirements."
        })
      }
    );
    const updated = await updateResponse.json();
    const approvals = repository.listDecisionObjectApprovals(decisionObject.object_id);

    assert.equal(updateResponse.status, 200);
    assert.equal(updated.decisionObject.currentVersion, 2);
    assert.equal(updated.invalidatedApprovals.length, 1);
    assert.equal(approvals[0].status, "invalidated");
    assert.equal(repository.listAuditEvents("project-draft-api").length, 2);

    const diffResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-draft-api/decision-objects/obj-draft-api/versions/diff?fromVersion=1&toVersion=2`
    );
    const diff = await diffResponse.json();

    assert.equal(diffResponse.status, 200);
    assert.equal(diff.fromVersion, 1);
    assert.equal(diff.toVersion, 2);
    assert.deepEqual(
      diff.changes.map((change) => change.field),
      ["content.requirement"]
    );
  } finally {
    server.close();
  }
});

test("decision object API assigns owners and audits ownership changes", async () => {
  const repository = createRepository();
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/projects/project-draft-api/decision-objects/obj-draft-api/owner`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ownerId: "user-eng-001"
        })
      }
    );
    const result = await response.json();
    const auditEvents = repository.listAuditEvents("project-draft-api");

    assert.equal(response.status, 200);
    assert.equal(result.decisionObject.ownerId, "user-eng-001");
    assert.equal(result.decisionObject.currentVersion, 1);
    assert.equal(auditEvents.length, 1);
    assert.equal(auditEvents[0].details.review_status, "owner_assigned");
    assert.equal(auditEvents[0].details.owner_id, "user-eng-001");
  } finally {
    server.close();
  }
});

test("decision object API blocks unauthorized ownership reassignment", async () => {
  const repository = createRepository();
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/projects/project-draft-api/decision-objects/obj-draft-api/owner`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-user-id": "user-eng-001"
        },
        body: JSON.stringify({
          ownerId: "user-operator-001"
        })
      }
    );
    const result = await response.json();

    assert.equal(response.status, 403);
    assert.equal(result.error, "FORBIDDEN");
    assert.equal(
      repository.findDecisionObject("project-draft-api", "obj-draft-api").owner_id,
      null
    );
  } finally {
    server.close();
  }
});

test("decision object API blocks unauthorized draft edits", async () => {
  const repository = createRepository();
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/projects/project-draft-api/decision-objects/obj-draft-api`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-user-id": "user-exec-viewer-001"
        },
        body: JSON.stringify({
          title: "Unauthorized edit",
          content: {
            requirement: "Should not save."
          }
        })
      }
    );
    const result = await response.json();

    assert.equal(response.status, 403);
    assert.equal(result.error, "FORBIDDEN");
    assert.equal(repository.findDecisionObject("project-draft-api", "obj-draft-api").title, decisionObject.title);
  } finally {
    server.close();
  }
});

function createRepository() {
  return createInMemoryProjectRepository({
    projects: [project],
    documents: [],
    aiGenerationJobs: [],
    decisionObjects: [decisionObject],
    decisionObjectVersions: [version],
    auditEvents: []
  });
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
