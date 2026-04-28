import test from "node:test";
import assert from "node:assert/strict";
import {
  APPROVAL_DECISIONS,
  APPROVAL_STATUSES,
  DECISION_OBJECT_TYPES,
  READINESS_STATUSES,
  TRACE_RELATIONSHIP_TYPES,
  buildCertificationPackage,
  evaluateProjectReadiness
} from "../../../packages/domain/src/index.js";

const programManager = {
  id: "user-pm-001",
  role: "program_manager",
  actorType: "human",
  displayName: "Priya Morgan"
};
const executiveViewer = {
  id: "user-exec-viewer-001",
  role: "executive_viewer",
  actorType: "human",
  displayName: "Elena Foster"
};

test("certification package generation is blocked until the readiness gate is open", () => {
  const requirement = decisionObject("obj-req-cert-blocked", DECISION_OBJECT_TYPES.REQUIREMENT);
  const requirementVersion = versionFor(requirement);
  const readiness = evaluateProjectReadiness(project, {
    decisionObjects: [requirement],
    decisionObjectVersions: [requirementVersion],
    traceLinks: [],
    approvals: [approvalFor(requirement, requirementVersion)]
  });
  const result = buildCertificationPackage(
    project,
    readiness,
    {
      decisionObjects: [requirement],
      decisionObjectVersions: [requirementVersion],
      traceLinks: [],
      approvals: [approvalFor(requirement, requirementVersion)],
      overrides: []
    },
    {},
    programManager
  );

  assert.equal(readiness.evaluation.status, READINESS_STATUSES.NOT_READY);
  assert.equal(result.ok, false);
  assert.ok(result.validation.errors.includes("PROJECT_NOT_READY"));
});

test("certification package includes exact versions, traceability, approvals, risks, blockers, and overrides", () => {
  const workflow = decisionObject("obj-workflow-cert", DECISION_OBJECT_TYPES.WORKFLOW);
  const requirement = decisionObject("obj-req-cert", DECISION_OBJECT_TYPES.REQUIREMENT);
  const testObject = decisionObject("obj-test-cert", DECISION_OBJECT_TYPES.TEST);
  const risk = decisionObject("obj-risk-cert", DECISION_OBJECT_TYPES.RISK);
  const workflowVersion = versionFor(workflow, { summary: "Approved workflow." });
  const requirementVersion = versionFor(requirement, {
    requirement: "The system shall generate a certification package.",
    acceptance_criteria: ["Package includes current version IDs."]
  });
  const testVersion = versionFor(testObject, {
    acceptance_criteria: ["Package preview is generated."]
  });
  const riskVersion = versionFor(risk, { risk: "Residual accepted risk remains visible." });
  const traceLinks = [
    traceLink(requirement, workflow, TRACE_RELATIONSHIP_TYPES.DERIVED_FROM),
    traceLink(requirement, testObject, TRACE_RELATIONSHIP_TYPES.VALIDATED_BY)
  ];
  const approvals = [
    approvalFor(workflow, workflowVersion),
    approvalFor(requirement, requirementVersion)
  ];
  const overrides = [
    {
      override_id: "override-cert-001",
      project_id: project.project_id,
      blocker_ids: ["blocker-risk"],
      authorized_by: programManager.id,
      authority_role: "program_manager",
      reason: "Proceed under accepted risk.",
      risk_acknowledgment: "Risk remains visible.",
      created_at: "2026-04-28T12:00:00.000Z",
      visibility: "dashboard_and_audit_trail"
    }
  ];
  const decisionObjects = [workflow, requirement, testObject, risk];
  const decisionObjectVersions = [
    workflowVersion,
    requirementVersion,
    testVersion,
    riskVersion
  ];
  const readiness = evaluateProjectReadiness(project, {
    decisionObjects,
    decisionObjectVersions,
    traceLinks,
    approvals,
    overrides
  });
  const result = buildCertificationPackage(
    project,
    readiness,
    { decisionObjects, decisionObjectVersions, traceLinks, approvals, overrides },
    {},
    programManager,
    {
      idGenerator: (kind) => `${kind}-unit`,
      now: new Date("2026-04-28T12:30:00.000Z")
    }
  );

  assert.equal(readiness.evaluation.status, READINESS_STATUSES.READY);
  assert.equal(result.ok, true);
  assert.equal(result.package.package_id, "certification-package-unit");
  assert.equal(result.package.includes_traceability_matrix, true);
  assert.equal(result.artifact.schemaVersion, "mvp-certification-package-v1");
  assert.equal(result.artifact.includedDecisionObjects.length, 4);
  assert.ok(
    result.artifact.includedDecisionObjects.some(
      (object) => object.includedVersionId === requirementVersion.version_id
    )
  );
  assert.equal(result.artifact.traceabilityMatrix.length, 2);
  assert.equal(result.artifact.approvals.length, 2);
  assert.equal(result.artifact.risks.length, 1);
  assert.equal(result.artifact.overrides.length, 1);
});

test("certification package generation requires export authority", () => {
  const readiness = {
    evaluation: {
      project_id: project.project_id,
      status: READINESS_STATUSES.READY,
      readiness_score: 100,
      rule_set_version: "mvp-readiness-v1",
      evaluated_at: "2026-04-28T12:00:00.000Z",
      summary: "Ready."
    },
    blockers: [],
    warnings: [],
    overrides: []
  };
  const result = buildCertificationPackage(project, readiness, {}, {}, executiveViewer);

  assert.equal(result.ok, false);
  assert.ok(result.validation.errors.includes("CERTIFICATION_UNAUTHORIZED"));
});

const project = {
  project_id: "project-cert-unit",
  name: "Certification Unit Project",
  readiness_status: "not_ready",
  readiness_score: 0
};

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
    change_reason: "Ready for package.",
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
