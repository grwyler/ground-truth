import test from "node:test";
import assert from "node:assert/strict";
import {
  APPROVAL_DECISIONS,
  APPROVAL_STATUSES,
  DECISION_OBJECT_TYPES,
  JIRA_EXPORT_STATUSES,
  READINESS_STATUSES,
  TRACE_RELATIONSHIP_TYPES,
  buildJiraExportJob,
  buildJiraExportPreview,
  evaluateProjectReadiness
} from "../../../packages/domain/src/index.js";
import { createMockJiraAdapter } from "../../../packages/integrations/jira/src/index.js";

const engineeringLead = {
  id: "user-eng-001",
  role: "engineering_lead",
  actorType: "human",
  displayName: "Evan Brooks"
};
const executiveViewer = {
  id: "user-exec-viewer-001",
  role: "executive_viewer",
  actorType: "human",
  displayName: "Elena Foster"
};

test("Jira export preview is blocked until readiness is open", () => {
  const requirement = decisionObject("obj-req-jira-blocked", DECISION_OBJECT_TYPES.REQUIREMENT);
  const requirementVersion = versionFor(requirement);
  const readiness = evaluateProjectReadiness(project, {
    decisionObjects: [requirement],
    decisionObjectVersions: [requirementVersion],
    traceLinks: [],
    approvals: [approvalFor(requirement, requirementVersion)]
  });
  const result = buildJiraExportPreview(
    project,
    readiness,
    {
      decisionObjects: [requirement],
      decisionObjectVersions: [requirementVersion],
      traceLinks: [],
      approvals: [approvalFor(requirement, requirementVersion)]
    },
    { jiraProjectKey: "GT" },
    engineeringLead
  );

  assert.equal(readiness.evaluation.status, READINESS_STATUSES.NOT_READY);
  assert.equal(result.ok, false);
  assert.ok(result.validation.errors.includes("PROJECT_NOT_READY"));
});

test("Jira export preview maps approved requirements with traceability metadata", () => {
  const { readiness, inputs, requirementVersion } = buildReadyInputs();
  const result = buildJiraExportPreview(
    project,
    readiness,
    inputs,
    { jiraProjectKey: "gt", includeTraceabilityLinks: true },
    engineeringLead
  );

  assert.equal(result.ok, true);
  assert.equal(result.preview.jiraProjectKey, "GT");
  assert.equal(result.preview.jiraMappingVersion, "mvp-jira-export-v1");
  assert.equal(result.preview.issues.length, 1);
  assert.equal(result.preview.issues[0].sourceRequirementId, "obj-req-jira");
  assert.equal(result.preview.issues[0].versionId, requirementVersion.version_id);
  assert.equal(result.preview.issues[0].workflowLink.objectId, "obj-workflow-jira");
  assert.equal(result.preview.issues[0].acceptanceCriteriaLink.objectId, "obj-test-jira");
  assert.equal(result.preview.issues[0].approvalMetadata.length, 1);
  assert.deepEqual(result.preview.issues[0].traceabilityMetadata.requiredLinkIds, [
    "link-obj-req-jira-obj-workflow-jira",
    "link-obj-req-jira-obj-test-jira"
  ]);
});

test("Jira export requires an authorized export role and valid project key", () => {
  const { readiness, inputs } = buildReadyInputs();
  const unauthorized = buildJiraExportPreview(
    project,
    readiness,
    inputs,
    { jiraProjectKey: "GT" },
    executiveViewer
  );
  const invalidKey = buildJiraExportPreview(
    project,
    readiness,
    inputs,
    { jiraProjectKey: "1bad" },
    engineeringLead
  );

  assert.equal(unauthorized.ok, false);
  assert.ok(unauthorized.validation.errors.includes("JIRA_EXPORT_UNAUTHORIZED"));
  assert.equal(invalidKey.ok, false);
  assert.ok(invalidKey.validation.errors.includes("JIRA_PROJECT_KEY_INVALID"));
});

test("mock Jira adapter creates issue mappings and supports failure state", () => {
  const { readiness, inputs } = buildReadyInputs();
  const preview = buildJiraExportPreview(
    project,
    readiness,
    inputs,
    { jiraProjectKey: "GT" },
    engineeringLead
  ).preview;
  const adapter = createMockJiraAdapter();
  const successResult = adapter.exportPreview(preview, {});
  const failedResult = adapter.exportPreview(
    { ...preview, jiraProjectKey: "FAIL" },
    {}
  );
  const successJob = buildJiraExportJob(
    project,
    preview,
    successResult,
    { jiraProjectKey: "GT" },
    engineeringLead,
    {
      idGenerator: (kind) => `${kind}-unit`,
      now: new Date("2026-04-28T12:30:00.000Z")
    }
  );

  assert.equal(successResult.status, JIRA_EXPORT_STATUSES.COMPLETED);
  assert.equal(successResult.createdIssues[0].jiraIssueKey, "GT-1");
  assert.equal(successJob.export_job_id, "jira-export-unit");
  assert.equal(successJob.jira_issue_mappings.createdIssues.length, 1);
  assert.equal(failedResult.status, JIRA_EXPORT_STATUSES.FAILED);
  assert.equal(failedResult.errors[0].code, "JIRA_EXPORT_FAILED");
});

const project = {
  project_id: "project-jira-unit",
  name: "Jira Unit Project"
};

function buildReadyInputs() {
  const workflow = decisionObject("obj-workflow-jira", DECISION_OBJECT_TYPES.WORKFLOW);
  const requirement = decisionObject("obj-req-jira", DECISION_OBJECT_TYPES.REQUIREMENT);
  const testObject = decisionObject("obj-test-jira", DECISION_OBJECT_TYPES.TEST);
  const workflowVersion = versionFor(workflow, { summary: "Jira-ready workflow." });
  const requirementVersion = versionFor(requirement, {
    requirement: "The system shall export approved requirements to Jira.",
    acceptance_criteria: ["Jira story includes traceability metadata."]
  });
  const testVersion = versionFor(testObject, {
    acceptance_criteria: ["Traceability metadata exists."]
  });
  const traceLinks = [
    traceLink(requirement, workflow, TRACE_RELATIONSHIP_TYPES.DERIVED_FROM),
    traceLink(requirement, testObject, TRACE_RELATIONSHIP_TYPES.VALIDATED_BY)
  ];
  const inputs = {
    decisionObjects: [workflow, requirement, testObject],
    decisionObjectVersions: [workflowVersion, requirementVersion, testVersion],
    traceLinks,
    approvals: [
      approvalFor(workflow, workflowVersion),
      approvalFor(requirement, requirementVersion)
    ],
    overrides: []
  };

  return {
    inputs,
    readiness: evaluateProjectReadiness(project, inputs),
    requirementVersion
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
