import test from "node:test";
import assert from "node:assert/strict";
import { createApiServer } from "../../../apps/api/src/server.js";
import { createInMemoryProjectRepository } from "../../../packages/db/src/index.js";
import {
  APPROVAL_DECISIONS,
  DECISION_OBJECT_STATUSES,
  DECISION_OBJECT_TYPES
} from "../../../packages/domain/src/index.js";

const project = {
  project_id: "project-approval-api",
  name: "Approval API Project",
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
const workflow = decisionObject("obj-workflow-approval", DECISION_OBJECT_TYPES.WORKFLOW);
const requirement = decisionObject("obj-requirement-approval", DECISION_OBJECT_TYPES.REQUIREMENT);

test("approval queue only returns items relevant to the current approver role", async () => {
  const repository = createRepository();
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const operatorResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-approval-api/approvals`,
      {
        headers: { "x-user-id": "user-operator-001" }
      }
    );
    const operatorQueue = await operatorResponse.json();
    const customerResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-approval-api/approvals`,
      {
        headers: { "x-user-id": "user-customer-pm-001" }
      }
    );
    const customerQueue = await customerResponse.json();

    assert.equal(operatorResponse.status, 200);
    assert.deepEqual(
      operatorQueue.queue.map((item) => item.objectId),
      ["obj-workflow-approval"]
    );
    assert.equal(customerResponse.status, 200);
    assert.deepEqual(
      customerQueue.queue.map((item) => item.objectId),
      ["obj-requirement-approval"]
    );
    assert.equal(customerQueue.queue[0].traceabilityStatus, "Workflow missing; test missing.");
  } finally {
    server.close();
  }
});

test("approval queue includes invalidation reason and diff for re-approval", async () => {
  const revisedRequirement = {
    ...requirement,
    current_version: 2,
    status: DECISION_OBJECT_STATUSES.DRAFT
  };
  const firstVersion = versionFor(revisedRequirement);
  const secondVersion = {
    ...firstVersion,
    version_id: "ver-obj-requirement-approval-2",
    version_number: 2,
    content: { summary: "Ready for approval: revised requirement text." }
  };
  const repository = createInMemoryProjectRepository({
    projects: [project],
    documents: [],
    aiGenerationJobs: [],
    decisionObjects: [workflow, revisedRequirement],
    decisionObjectVersions: [versionFor(workflow), firstVersion, secondVersion],
    approvals: [
      {
        approval_id: "approval-invalidated-requirement",
        object_id: revisedRequirement.object_id,
        version_id: firstVersion.version_id,
        approver_id: "user-customer-pm-001",
        decision: "approved",
        comment: "Approved previous text.",
        status: "invalidated",
        created_at: "2026-04-28T12:00:00.000Z",
        invalidated_at: "2026-04-28T13:00:00.000Z",
        invalidation_reason:
          "Version 1 was superseded by version 2 after a meaningful content change."
      }
    ],
    auditEvents: []
  });
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/projects/project-approval-api/approvals`,
      {
        headers: { "x-user-id": "user-customer-pm-001" }
      }
    );
    const queue = await response.json();

    assert.equal(response.status, 200);
    assert.equal(queue.queue.length, 1);
    assert.equal(queue.queue[0].invalidatedApproval.approvalId, "approval-invalidated-requirement");
    assert.equal(queue.queue[0].diff.fromVersion, 1);
    assert.deepEqual(
      queue.queue[0].diff.changes.map((change) => change.field),
      ["content.summary"]
    );
  } finally {
    server.close();
  }
});

test("assigned approver can approve, reject, and request changes for the current version", async () => {
  const repository = createRepository();
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const approveResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-approval-api/decision-objects/obj-workflow-approval/approvals`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id": "user-operator-001"
        },
        body: JSON.stringify({
          version: 1,
          approvalDecision: "approved",
          comment: "Workflow is operationally sound."
        })
      }
    );
    const approved = await approveResponse.json();

    assert.equal(approveResponse.status, 201);
    assert.equal(approved.approval.approvalDecision, APPROVAL_DECISIONS.APPROVED);
    assert.equal(approved.decisionObject.status, DECISION_OBJECT_STATUSES.APPROVED);

    const rejectResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-approval-api/decision-objects/obj-requirement-approval/approvals`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id": "user-customer-pm-001"
        },
        body: JSON.stringify({
          version: 1,
          approvalDecision: "rejected",
          comment: "Customer scope does not match."
        })
      }
    );
    const rejected = await rejectResponse.json();

    assert.equal(rejectResponse.status, 201);
    assert.equal(rejected.approval.approvalDecision, APPROVAL_DECISIONS.REJECTED);
    assert.equal(rejected.decisionObject.status, DECISION_OBJECT_STATUSES.REJECTED);

    const changesResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-approval-api/decision-objects/obj-requirement-approval/approvals`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id": "user-customer-pm-001"
        },
        body: JSON.stringify({
          version: 1,
          approvalDecision: "changes_requested",
          comment: "Clarify retention wording."
        })
      }
    );
    const changesRequested = await changesResponse.json();

    assert.equal(changesResponse.status, 201);
    assert.equal(
      changesRequested.approval.approvalDecision,
      APPROVAL_DECISIONS.CHANGES_REQUESTED
    );
    assert.equal(changesRequested.decisionObject.status, DECISION_OBJECT_STATUSES.IN_REVIEW);
    assert.equal(repository.listAuditEvents("project-approval-api").length, 3);
  } finally {
    server.close();
  }
});

test("approval API blocks unauthorized and malformed approval decisions", async () => {
  const repository = createRepository();
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const unauthorizedResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-approval-api/decision-objects/obj-workflow-approval/approvals`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id": "user-customer-pm-001"
        },
        body: JSON.stringify({
          version: 1,
          approvalDecision: "approved"
        })
      }
    );
    const unauthorized = await unauthorizedResponse.json();

    assert.equal(unauthorizedResponse.status, 400);
    assert.equal(unauthorized.error, "UNAUTHORIZED_APPROVER");

    const missingCommentResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-approval-api/decision-objects/obj-requirement-approval/approvals`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id": "user-customer-pm-001"
        },
        body: JSON.stringify({
          version: 1,
          approvalDecision: "changes_requested"
        })
      }
    );
    const missingComment = await missingCommentResponse.json();

    assert.equal(missingCommentResponse.status, 400);
    assert.deepEqual(missingComment.details, ["APPROVAL_COMMENT_REQUIRED"]);
  } finally {
    server.close();
  }
});

function createRepository() {
  return createInMemoryProjectRepository({
    projects: [project],
    documents: [],
    aiGenerationJobs: [],
    decisionObjects: [workflow, requirement],
    decisionObjectVersions: [versionFor(workflow), versionFor(requirement)],
    approvals: [],
    auditEvents: []
  });
}

function decisionObject(objectId, type) {
  return {
    object_id: objectId,
    project_id: "project-approval-api",
    type,
    title: objectId,
    current_version: 1,
    status: DECISION_OBJECT_STATUSES.IN_REVIEW,
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
    content: { summary: `Ready for approval: ${decisionObjectRecord.title}` },
    change_reason: "Submitted for approval.",
    changed_by: "user-eng-001",
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
