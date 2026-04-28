import test from "node:test";
import assert from "node:assert/strict";
import { createApiServer } from "../../apps/api/src/server.js";
import { createInMemoryProjectRepository } from "../../packages/db/src/index.js";
import { DECISION_OBJECT_STATUSES } from "../../packages/domain/src/index.js";

test("operator representative approves a workflow from the approval queue", async () => {
  const repository = createInMemoryProjectRepository({
    projects: [
      {
        project_id: "project-e2e-approval",
        name: "Approval E2E Project",
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
      }
    ],
    documents: [],
    aiGenerationJobs: [],
    decisionObjects: [
      {
        object_id: "obj-e2e-workflow",
        project_id: "project-e2e-approval",
        type: "workflow",
        title: "Operator intake workflow",
        current_version: 1,
        status: DECISION_OBJECT_STATUSES.IN_REVIEW,
        owner_id: "user-operator-001",
        priority: "high",
        created_by: "system-ai-assistant",
        created_at: "2026-04-28T12:00:00.000Z",
        updated_at: "2026-04-28T12:00:00.000Z"
      }
    ],
    decisionObjectVersions: [
      {
        version_id: "ver-e2e-workflow-1",
        object_id: "obj-e2e-workflow",
        version_number: 1,
        content: { summary: "Operator receives and completes an intake assignment." },
        change_reason: "Submitted for operator approval.",
        changed_by: "user-operator-001",
        created_at: "2026-04-28T12:00:00.000Z",
        meaningful_change: true
      }
    ],
    approvals: [],
    auditEvents: []
  });
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const queueResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-e2e-approval/approvals`,
      {
        headers: { "x-user-id": "user-operator-001" }
      }
    );
    const queue = await queueResponse.json();

    assert.equal(queueResponse.status, 200);
    assert.deepEqual(
      queue.queue.map((item) => item.objectId),
      ["obj-e2e-workflow"]
    );

    const approveResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-e2e-approval/decision-objects/obj-e2e-workflow/approvals`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id": "user-operator-001"
        },
        body: JSON.stringify({
          version: 1,
          approvalDecision: "approved",
          comment: "Workflow matches operator expectations."
        })
      }
    );
    const approved = await approveResponse.json();

    assert.equal(approveResponse.status, 201);
    assert.equal(approved.decisionObject.status, DECISION_OBJECT_STATUSES.APPROVED);
    assert.equal(repository.listAuditEvents("project-e2e-approval").length, 1);

    const completedQueueResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-e2e-approval/approvals`,
      {
        headers: { "x-user-id": "user-operator-001" }
      }
    );
    const completedQueue = await completedQueueResponse.json();

    assert.equal(completedQueue.queue.length, 0);
  } finally {
    server.close();
  }
});

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
