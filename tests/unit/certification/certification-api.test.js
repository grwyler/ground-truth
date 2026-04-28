import test from "node:test";
import assert from "node:assert/strict";
import { createApiServer } from "../../../apps/api/src/server.js";
import { createInMemoryProjectRepository } from "../../../packages/db/src/index.js";
import {
  APPROVAL_DECISIONS,
  APPROVAL_STATUSES,
  DECISION_OBJECT_TYPES,
  TRACE_RELATIONSHIP_TYPES
} from "../../../packages/domain/src/index.js";

test("certification API blocks package generation when project is Not Ready", async () => {
  const requirement = decisionObject("obj-req-cert-api-blocked", DECISION_OBJECT_TYPES.REQUIREMENT);
  const requirementVersion = versionFor(requirement);
  const repository = createRepository({
    decisionObjects: [requirement],
    decisionObjectVersions: [requirementVersion],
    approvals: [approvalFor(requirement, requirementVersion)]
  });
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/projects/project-cert-api/certification-package`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id": "user-pm-001"
        },
        body: JSON.stringify({})
      }
    );
    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(body.error, "PROJECT_NOT_READY");
    assert.ok(body.blockers.length >= 1);
    assert.equal(repository.listProjectCertificationPackages("project-cert-api").length, 0);
  } finally {
    server.close();
  }
});

test("certification API persists generated package metadata and audit event", async () => {
  const workflow = decisionObject("obj-workflow-cert-api", DECISION_OBJECT_TYPES.WORKFLOW);
  const requirement = decisionObject("obj-req-cert-api", DECISION_OBJECT_TYPES.REQUIREMENT);
  const testObject = decisionObject("obj-test-cert-api", DECISION_OBJECT_TYPES.TEST);
  const workflowVersion = versionFor(workflow, { summary: "Approved workflow." });
  const requirementVersion = versionFor(requirement, {
    requirement: "The system shall generate a certification package.",
    acceptance_criteria: ["Package includes traceability."]
  });
  const testVersion = versionFor(testObject, {
    acceptance_criteria: ["Traceability is present."]
  });
  const repository = createRepository({
    decisionObjects: [workflow, requirement, testObject],
    decisionObjectVersions: [workflowVersion, requirementVersion, testVersion],
    traceLinks: [
      traceLink(requirement, workflow, TRACE_RELATIONSHIP_TYPES.DERIVED_FROM),
      traceLink(requirement, testObject, TRACE_RELATIONSHIP_TYPES.VALIDATED_BY)
    ],
    approvals: [
      approvalFor(workflow, workflowVersion),
      approvalFor(requirement, requirementVersion)
    ]
  });
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/projects/project-cert-api/certification-package`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id": "user-eng-001"
        },
        body: JSON.stringify({
          includeTraceabilityMatrix: true,
          includeApprovals: true,
          includeRisks: true,
          includeOverrides: true
        })
      }
    );
    const body = await response.json();
    const packages = repository.listProjectCertificationPackages("project-cert-api");
    const auditEvents = repository.listAuditEvents("project-cert-api");

    assert.equal(response.status, 201);
    assert.equal(body.package.status, "generated");
    assert.equal(body.package.artifact.traceabilityMatrix.length, 2);
    assert.equal(body.package.artifact.approvals.length, 2);
    assert.equal(packages.length, 1);
    assert.equal(packages[0].status, "generated");
    assert.ok(auditEvents.some((event) => event.entity_type === "certification_package"));
  } finally {
    server.close();
  }
});

test("certification API rejects users without generation authority", async () => {
  const repository = createRepository();
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/projects/project-cert-api/certification-package`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id": "user-exec-viewer-001"
        },
        body: JSON.stringify({})
      }
    );

    assert.equal(response.status, 403);
  } finally {
    server.close();
  }
});

const project = {
  project_id: "project-cert-api",
  name: "Certification API Project",
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
    blockers: [],
    overrides,
    certificationPackages: [],
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
    change_reason: "Ready for certification.",
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
