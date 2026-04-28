import test from "node:test";
import assert from "node:assert/strict";
import { createApiServer } from "../../../apps/api/src/server.js";
import { createInMemoryProjectRepository } from "../../../packages/db/src/index.js";
import {
  APPROVAL_DECISIONS,
  APPROVAL_STATUSES,
  DECISION_OBJECT_TYPES,
  READINESS_STATUSES
} from "../../../packages/domain/src/index.js";

test("override API records PM risk acceptance and updates readiness gate state", async () => {
  const repository = createRepository();
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const response = await fetch(`${baseUrl}/api/v1/projects/project-override-api/overrides`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-id": "user-pm-001"
      },
      body: JSON.stringify({
        blockerIds: [
          "blocker-project-override-api-obj-req-override-missing-workflow-link",
          "blocker-project-override-api-obj-req-override-missing-acceptance-criteria"
        ],
        reason: "Pilot start approved while traceability is completed.",
        riskAcknowledgment: "PM accepts visible traceability risk for this blocker set."
      })
    });
    const body = await response.json();
    const auditEvents = repository.listAuditEvents("project-override-api");

    assert.equal(response.status, 201);
    assert.equal(body.override.authorizedBy, "user-pm-001");
    assert.deepEqual(body.override.blockerIds, [
      "blocker-project-override-api-obj-req-override-missing-workflow-link",
      "blocker-project-override-api-obj-req-override-missing-acceptance-criteria"
    ]);
    assert.equal(body.readiness.status, READINESS_STATUSES.READY);
    assert.equal(body.readiness.hardBlockers.length, 0);
    assert.equal(body.readiness.resolvedBlockers.length, 2);
    assert.equal(repository.listProjectOverrides("project-override-api").length, 1);
    assert.ok(auditEvents.some((event) => event.event_type === "override"));
  } finally {
    server.close();
  }
});

test("override API rejects missing reason and risk acknowledgment", async () => {
  const repository = createRepository();
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const response = await fetch(`${baseUrl}/api/v1/projects/project-override-api/overrides`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-id": "user-pm-001"
      },
      body: JSON.stringify({
        blockerIds: ["blocker-project-override-api-obj-req-override-missing-workflow-link"],
        reason: "",
        riskAcknowledgment: ""
      })
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, "VALIDATION_ERROR");
    assert.ok(body.details.includes("OVERRIDE_REASON_REQUIRED"));
    assert.ok(body.details.includes("OVERRIDE_RISK_ACKNOWLEDGMENT_REQUIRED"));
    assert.equal(repository.listProjectOverrides("project-override-api").length, 0);
  } finally {
    server.close();
  }
});

test("override API denies non-PM users", async () => {
  const repository = createRepository();
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const response = await fetch(`${baseUrl}/api/v1/projects/project-override-api/overrides`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-id": "user-eng-001"
      },
      body: JSON.stringify({
        blockerIds: ["blocker-project-override-api-obj-req-override-missing-workflow-link"],
        reason: "Engineering lead cannot accept this project risk.",
        riskAcknowledgment: "This should be rejected."
      })
    });

    assert.equal(response.status, 403);
    assert.equal(repository.listProjectOverrides("project-override-api").length, 0);
  } finally {
    server.close();
  }
});

const project = {
  project_id: "project-override-api",
  name: "Override API Project",
  description: null,
  customer: null,
  contract_number: null,
  program_name: null,
  status: "not_ready",
  readiness_status: "not_ready",
  readiness_score: 0,
  created_by: "user-pm-001",
  created_at: "2026-04-28T12:00:00.000Z",
  updated_at: "2026-04-28T12:00:00.000Z"
};
const requirement = {
  object_id: "obj-req-override",
  project_id: project.project_id,
  type: DECISION_OBJECT_TYPES.REQUIREMENT,
  title: "Override requirement",
  current_version: 1,
  status: "in_review",
  owner_id: "user-eng-001",
  priority: "high",
  created_by: "user-pm-001",
  created_at: "2026-04-28T12:00:00.000Z",
  updated_at: "2026-04-28T12:00:00.000Z"
};
const requirementVersion = {
  version_id: "ver-obj-req-override",
  object_id: requirement.object_id,
  version_number: 1,
  content: {},
  change_reason: "Ready for readiness evaluation.",
  changed_by: "user-eng-001",
  created_at: "2026-04-28T12:00:00.000Z",
  meaningful_change: true
};

function createRepository() {
  return createInMemoryProjectRepository({
    projects: [project],
    documents: [],
    aiGenerationJobs: [],
    decisionObjects: [requirement],
    decisionObjectVersions: [requirementVersion],
    traceLinks: [],
    approvals: [
      {
        approval_id: "approval-obj-req-override",
        object_id: requirement.object_id,
        version_id: requirementVersion.version_id,
        approver_id: "user-customer-pm-001",
        decision: APPROVAL_DECISIONS.APPROVED,
        comment: "Approved while risk acceptance handles traceability.",
        status: APPROVAL_STATUSES.ACTIVE,
        created_at: "2026-04-28T12:00:00.000Z",
        invalidated_at: null,
        invalidation_reason: null
      }
    ],
    readinessEvaluations: [],
    blockers: [],
    overrides: [],
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
