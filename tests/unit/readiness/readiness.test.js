import test from "node:test";
import assert from "node:assert/strict";
import {
  APPROVAL_DECISIONS,
  APPROVAL_STATUSES,
  BLOCKER_STATUSES,
  BLOCKER_TYPES,
  DECISION_OBJECT_TYPES,
  READINESS_RULE_SET_VERSION,
  READINESS_STATUSES,
  TRACE_RELATIONSHIP_TYPES,
  evaluateProjectReadiness
} from "../../../packages/domain/src/index.js";

test("readiness flags missing workflow traceability, test traceability, and approvals", () => {
  const requirement = decisionObject("obj-req-unready", DECISION_OBJECT_TYPES.REQUIREMENT);
  const result = evaluateProjectReadiness(project, {
    decisionObjects: [requirement],
    decisionObjectVersions: [versionFor(requirement, { acceptance_criteria: [] })],
    traceLinks: [],
    approvals: [],
    overrides: []
  });

  assert.equal(result.evaluation.status, READINESS_STATUSES.NOT_READY);
  assert.equal(result.evaluation.rule_set_version, READINESS_RULE_SET_VERSION);
  assert.equal(result.evaluation.readiness_score, 0);
  assert.deepEqual(
    result.blockers.map((blocker) => blocker.type),
    [
      BLOCKER_TYPES.MISSING_TRACEABILITY,
      BLOCKER_TYPES.MISSING_TRACEABILITY,
      BLOCKER_TYPES.MISSING_APPROVAL
    ]
  );
  assert.deepEqual(
    result.blockers.map((blocker) => blocker.status),
    [BLOCKER_STATUSES.OPEN, BLOCKER_STATUSES.OPEN, BLOCKER_STATUSES.OPEN]
  );
});

test("readiness returns Ready when requirements have mandatory links and current approvals", () => {
  const workflow = decisionObject("obj-workflow-ready", DECISION_OBJECT_TYPES.WORKFLOW);
  const requirement = decisionObject("obj-req-ready", DECISION_OBJECT_TYPES.REQUIREMENT);
  const testObject = decisionObject("obj-test-ready", DECISION_OBJECT_TYPES.TEST);
  const workflowVersion = versionFor(workflow);
  const requirementVersion = versionFor(requirement, {
    acceptance_criteria: ["Given a condition, then the expected outcome is observable."]
  });
  const result = evaluateProjectReadiness(project, {
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
    overrides: []
  });

  assert.equal(result.evaluation.status, READINESS_STATUSES.READY);
  assert.equal(result.evaluation.readiness_score, 100);
  assert.deepEqual(result.blockers, []);
});

test("readiness treats authorized overrides as resolving specific generated blockers", () => {
  const requirement = decisionObject("obj-req-overridden", DECISION_OBJECT_TYPES.REQUIREMENT);
  const testObject = decisionObject("obj-test-overridden", DECISION_OBJECT_TYPES.TEST);
  const missingWorkflowBlockerId =
    "blocker-project-readiness-unit-obj-req-overridden-missing-workflow-link";
  const result = evaluateProjectReadiness(project, {
    decisionObjects: [requirement, testObject],
    decisionObjectVersions: [
      versionFor(requirement, {
        acceptance_criteria: ["Acceptance criteria exist for this requirement."]
      })
    ],
    traceLinks: [
      traceLink(
        requirement,
        testObject,
        TRACE_RELATIONSHIP_TYPES.VALIDATED_BY
      )
    ],
    approvals: [approvalFor(requirement, versionFor(requirement))],
    overrides: [
      {
        override_id: "override-missing-workflow",
        project_id: project.project_id,
        blocker_ids: [missingWorkflowBlockerId],
        authorized_by: "user-pm-001",
        authority_role: "program_manager",
        reason: "Proceed under named risk.",
        risk_acknowledgment: "Risk accepted.",
        created_at: "2026-04-28T12:00:00.000Z",
        visibility: "dashboard_and_audit_trail"
      }
    ]
  });

  assert.equal(result.evaluation.status, READINESS_STATUSES.READY);
  assert.equal(result.evaluation.readiness_score, 99);
  assert.equal(result.blockers.length, 1);
  assert.equal(result.blockers[0].blocker_id, missingWorkflowBlockerId);
  assert.equal(result.blockers[0].status, BLOCKER_STATUSES.OVERRIDDEN);
});

const project = {
  project_id: "project-readiness-unit",
  name: "Readiness Unit Project"
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
