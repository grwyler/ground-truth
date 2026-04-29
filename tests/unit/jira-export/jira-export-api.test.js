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

test("Jira export API blocks Not Ready projects and records the attempt", async () => {
  const requirement = decisionObject("obj-req-jira-api-blocked", DECISION_OBJECT_TYPES.REQUIREMENT);
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
      `${baseUrl}/api/v1/projects/project-jira-api/integrations/jira/export`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id": "user-eng-001"
        },
        body: JSON.stringify({
          jiraProjectKey: "GT",
          exportMode: "CreateEpicsAndStories",
          includeTraceabilityLinks: true
        })
      }
    );
    const body = await response.json();
    const exports = repository.listJiraExports("project-jira-api");
    const auditEvents = repository.listAuditEvents("project-jira-api");

    assert.equal(response.status, 409);
    assert.equal(body.error, "PROJECT_NOT_READY");
    assert.ok(body.blockers.length >= 1);
    assert.equal(exports.length, 1);
    assert.equal(exports[0].status, "failed");
    assert.equal(exports[0].error_summary, "PROJECT_NOT_READY");
    assert.ok(auditEvents.some((event) => event.entity_type === "jira_export"));
  } finally {
    server.close();
  }
});

test("Jira export API creates a mock export job and returns status by ID", async () => {
  const ready = buildReadyRecords();
  const repository = createRepository(ready);
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/projects/project-jira-api/integrations/jira/export`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id": "user-eng-001"
        },
        body: JSON.stringify({
          jiraProjectKey: "GT",
          exportMode: "CreateEpicsAndStories",
          includeTraceabilityLinks: true
        })
      }
    );
    const body = await response.json();
    const statusResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-jira-api/integrations/jira/export-jobs/${body.exportJob.exportJobId}`,
      {
        headers: {
          "x-user-id": "user-exec-viewer-001"
        }
      }
    );
    const statusBody = await statusResponse.json();

    assert.equal(response.status, 202);
    assert.equal(body.exportJob.status, "completed");
    assert.equal(body.exportJob.createdIssues[0].jiraIssueKey, "GT-1");
    const story = body.exportJob.preview.find((issue) => issue.issueType === "Story");
    assert.ok(story);
    assert.equal(story.workflowLink.objectId, "obj-workflow-jira-api");
    assert.equal(statusResponse.status, 200);
    assert.equal(statusBody.exportJob.exportJobId, body.exportJob.exportJobId);
    assert.equal(repository.listJiraExports("project-jira-api").length, 1);
  } finally {
    server.close();
  }
});

test("Jira export API persists failed mock adapter state for retry visibility", async () => {
  const repository = createRepository(buildReadyRecords());
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/projects/project-jira-api/integrations/jira/export`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id": "user-pm-001"
        },
        body: JSON.stringify({
          jiraProjectKey: "FAIL",
          exportMode: "CreateEpicsAndStories",
          includeTraceabilityLinks: true
        })
      }
    );
    const body = await response.json();

    assert.equal(response.status, 202);
    assert.equal(body.exportJob.status, "failed");
    assert.equal(body.exportJob.errors[0].code, "JIRA_EXPORT_FAILED");
    assert.equal(repository.listJiraExports("project-jira-api")[0].error_summary, "JIRA_EXPORT_FAILED");
  } finally {
    server.close();
  }
});

test("Jira export API rejects unauthorized users", async () => {
  const repository = createRepository(buildReadyRecords());
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/projects/project-jira-api/integrations/jira/export`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id": "user-exec-viewer-001"
        },
        body: JSON.stringify({ jiraProjectKey: "GT" })
      }
    );

    assert.equal(response.status, 403);
  } finally {
    server.close();
  }
});

const project = {
  project_id: "project-jira-api",
  name: "Jira API Project",
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
    certificationPackages: [],
    jiraExports: [],
    auditEvents: []
  });
}

function buildReadyRecords() {
  const workflow = decisionObject("obj-workflow-jira-api", DECISION_OBJECT_TYPES.WORKFLOW);
  const requirement = decisionObject("obj-req-jira-api", DECISION_OBJECT_TYPES.REQUIREMENT);
  const testObject = decisionObject("obj-test-jira-api", DECISION_OBJECT_TYPES.TEST);
  const workflowVersion = versionFor(workflow);
  const requirementVersion = versionFor(requirement, {
    requirement: "The system shall export approved Jira stories.",
    acceptance_criteria: ["Jira payload includes source metadata."]
  });
  const testVersion = versionFor(testObject);

  return {
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
  };
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
    change_reason: "Ready for Jira export.",
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
