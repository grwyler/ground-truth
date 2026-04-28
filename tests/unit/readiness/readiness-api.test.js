import test from "node:test";
import assert from "node:assert/strict";
import { createApiServer } from "../../../apps/api/src/server.js";
import { createInMemoryProjectRepository } from "../../../packages/db/src/index.js";
import { createMvpSeedData } from "../../../packages/db/src/seed/mvp-seed.js";
import {
  APPROVAL_DECISIONS,
  APPROVAL_STATUSES,
  BLOCKER_STATUSES,
  DECISION_OBJECT_TYPES,
  READINESS_STATUSES,
  TRACE_RELATIONSHIP_TYPES
} from "../../../packages/domain/src/index.js";

test("readiness API returns Not Ready blockers for seeded data within the MVP target", async () => {
  const repository = createInMemoryProjectRepository(createMvpSeedData());
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const startedAt = Date.now();
    const response = await fetch(`${baseUrl}/api/v1/projects/seed-project/readiness`, {
      headers: { "x-user-id": "user-pm-001" }
    });
    const elapsedMs = Date.now() - startedAt;
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.readiness.status, READINESS_STATUSES.NOT_READY);
    assert.ok(body.readiness.hardBlockers.length >= 1);
    assert.ok(body.readiness.hardBlockers.every((blocker) => blocker.ownerId));
    assert.ok(elapsedMs < 2000);
    assert.equal(repository.listReadinessEvaluations("seed-project").length, 2);
  } finally {
    server.close();
  }
});

test("readiness API returns Ready when current requirements and workflows are linked and approved", async () => {
  const workflow = decisionObject("obj-workflow-api-ready", DECISION_OBJECT_TYPES.WORKFLOW);
  const requirement = decisionObject("obj-req-api-ready", DECISION_OBJECT_TYPES.REQUIREMENT);
  const testObject = decisionObject("obj-test-api-ready", DECISION_OBJECT_TYPES.TEST);
  const workflowVersion = versionFor(workflow);
  const requirementVersion = versionFor(requirement, {
    acceptance_criteria: ["Given the ready state, then the gate opens."]
  });
  const repository = createRepository({
    decisionObjects: [workflow, requirement, testObject],
    decisionObjectVersions: [workflowVersion, requirementVersion, versionFor(testObject)],
    traceLinks: [
      traceLink(requirement, workflow, TRACE_RELATIONSHIP_TYPES.DERIVED_FROM),
      traceLink(requirement, testObject, TRACE_RELATIONSHIP_TYPES.VALIDATED_BY)
    ],
    approvals: [
      approvalFor(workflow, workflowVersion),
      approvalFor(requirement, requirementVersion)
    ],
    blockers: [
      {
        blocker_id:
          "blocker-project-readiness-api-obj-req-api-ready-missing-required-approval",
        project_id: "project-readiness-api",
        object_id: requirement.object_id,
        type: "missing_approval",
        severity: "high",
        description: "Stale blocker from a prior evaluation.",
        status: "open",
        created_at: "2026-04-28T12:00:00.000Z",
        resolved_at: null
      }
    ]
  });
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const response = await fetch(`${baseUrl}/api/v1/projects/project-readiness-api/readiness`, {
      headers: { "x-user-id": "user-exec-viewer-001" }
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.readiness.status, READINESS_STATUSES.READY);
    assert.equal(body.readiness.readinessScore, 100);
    assert.deepEqual(body.readiness.hardBlockers, []);
    assert.deepEqual(repository.listProjectBlockers("project-readiness-api"), []);
  } finally {
    server.close();
  }
});

test("readiness API does not keep the gate closed for overridden generated blockers", async () => {
  const requirement = decisionObject("obj-req-api-overridden", DECISION_OBJECT_TYPES.REQUIREMENT);
  const testObject = decisionObject("obj-test-api-overridden", DECISION_OBJECT_TYPES.TEST);
  const requirementVersion = versionFor(requirement, {
    acceptance_criteria: ["Acceptance criteria exist."]
  });
  const overriddenBlockerId =
    "blocker-project-readiness-api-obj-req-api-overridden-missing-workflow-link";
  const repository = createRepository({
    decisionObjects: [requirement, testObject],
    decisionObjectVersions: [requirementVersion, versionFor(testObject)],
    traceLinks: [traceLink(requirement, testObject, TRACE_RELATIONSHIP_TYPES.VALIDATED_BY)],
    approvals: [approvalFor(requirement, requirementVersion)],
    overrides: [
      {
        override_id: "override-api-readiness",
        project_id: "project-readiness-api",
        blocker_ids: [overriddenBlockerId],
        authorized_by: "user-pm-001",
        authority_role: "program_manager",
        reason: "Proceed with PM risk acceptance.",
        risk_acknowledgment: "Risk is visible and accepted.",
        created_at: "2026-04-28T12:00:00.000Z",
        visibility: "dashboard_and_audit_trail"
      }
    ]
  });
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const response = await fetch(`${baseUrl}/api/v1/projects/project-readiness-api/readiness`, {
      headers: { "x-user-id": "user-pm-001" }
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.readiness.status, READINESS_STATUSES.READY);
    assert.equal(body.readiness.hardBlockers.length, 0);
    assert.equal(body.readiness.resolvedBlockers[0].blockerId, overriddenBlockerId);
    assert.equal(body.readiness.resolvedBlockers[0].status, BLOCKER_STATUSES.OVERRIDDEN);
  } finally {
    server.close();
  }
});

test("readiness API enforces project read authorization", async () => {
  const repository = createRepository();
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const unauthenticatedResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-readiness-api/readiness`,
      {
        headers: { "x-user-id": "missing-user" }
      }
    );
    const aiResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-readiness-api/readiness`,
      {
        headers: { "x-user-id": "system-ai-assistant" }
      }
    );

    assert.equal(unauthenticatedResponse.status, 401);
    assert.equal(aiResponse.status, 403);
  } finally {
    server.close();
  }
});

const project = {
  project_id: "project-readiness-api",
  name: "Readiness API Project",
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

function createRepository({
  decisionObjects = [],
  decisionObjectVersions = [],
  traceLinks = [],
  approvals = [],
  blockers = [],
  overrides = []
} = {}) {
  return createInMemoryProjectRepository({
    projects: [project],
    documents: [],
    aiGenerationJobs: [],
    decisionObjects,
    decisionObjectVersions,
    traceLinks,
    approvals,
    readinessEvaluations: [],
    blockers,
    overrides,
    auditEvents: []
  });
}

function decisionObject(objectId, type) {
  return {
    object_id: objectId,
    project_id: project.project_id,
    type,
    title: objectId,
    current_version: 1,
    status: "in_review",
    owner_id: "user-eng-001",
    priority: "high",
    created_by: "user-pm-001",
    created_at: "2026-04-28T12:00:00.000Z",
    updated_at: "2026-04-28T12:00:00.000Z"
  };
}

function versionFor(decisionObjectRecord, content = {}) {
  return {
    version_id: `ver-${decisionObjectRecord.object_id}`,
    object_id: decisionObjectRecord.object_id,
    version_number: 1,
    content,
    change_reason: "Ready for readiness evaluation.",
    changed_by: "user-eng-001",
    created_at: "2026-04-28T12:00:00.000Z",
    meaningful_change: true
  };
}

function traceLink(sourceObject, targetObject, relationshipType) {
  return {
    link_id: `link-${sourceObject.object_id}-${targetObject.object_id}`,
    project_id: project.project_id,
    source_object_id: sourceObject.object_id,
    target_object_id: targetObject.object_id,
    relationship_type: relationshipType,
    required_for_readiness: true,
    created_by: "user-eng-001",
    created_at: "2026-04-28T12:00:00.000Z"
  };
}

function approvalFor(decisionObjectRecord, version) {
  return {
    approval_id: `approval-${decisionObjectRecord.object_id}`,
    object_id: decisionObjectRecord.object_id,
    version_id: version.version_id,
    approver_id: "user-customer-pm-001",
    decision: APPROVAL_DECISIONS.APPROVED,
    comment: "Approved.",
    status: APPROVAL_STATUSES.ACTIVE,
    created_at: "2026-04-28T12:00:00.000Z",
    invalidated_at: null,
    invalidation_reason: null
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
