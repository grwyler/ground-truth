import test from "node:test";
import assert from "node:assert/strict";
import {
  DECISION_OBJECT_TYPES,
  READINESS_STATUSES,
  SEEDED_MVP_USERS
} from "../../../packages/domain/src/index.js";
import {
  createLocalAiGenerationService,
  createLocalProjectService
} from "../../../apps/web/src/main.js";

const [programManager, engineeringLead, operatorRepresentative, customerPm] =
  SEEDED_MVP_USERS;

test("local readiness dashboard explains seeded Not Ready state with blockers and overrides", () => {
  const service = createLocalAiGenerationService();
  const dashboard = service.getReadinessDashboard("seed-project");

  assert.equal(dashboard.status, READINESS_STATUSES.NOT_READY);
  assert.equal(dashboard.jiraExportDisabled, true);
  assert.ok(dashboard.hardBlockers.length >= 1);
  assert.ok(dashboard.hardBlockers.every((blocker) => blocker.ownerName !== "Ownership needed"));
  assert.ok(dashboard.pendingApprovalCount >= 1);
  assert.equal(dashboard.openRiskCount, 1);
  assert.equal(dashboard.overrideCount, 1);
  assert.equal(dashboard.scoreBreakdown.ruleSetVersion, "mvp-readiness-v1");
});

test("local readiness dashboard opens the gate when links and approvals are complete", () => {
  const projectService = createLocalProjectService([
    {
      projectId: "project-dashboard-ready",
      name: "Dashboard Ready Project",
      description: null,
      customer: null,
      contractNumber: null,
      programName: null,
      status: "draft",
      readinessStatus: "not_ready",
      readinessScore: 0,
      createdBy: programManager.id,
      createdAt: "2026-04-28T12:00:00.000Z",
      updatedAt: "2026-04-28T12:00:00.000Z"
    }
  ]);
  const service = createLocalAiGenerationService(projectService);
  const workflow = service.createDecisionObject(
    "project-dashboard-ready",
    {
      type: DECISION_OBJECT_TYPES.WORKFLOW,
      title: "Ready workflow",
      content: { summary: "Operator completes the ready workflow." },
      ownerId: operatorRepresentative.id
    },
    programManager
  );
  const requirement = service.createDecisionObject(
    "project-dashboard-ready",
    {
      type: DECISION_OBJECT_TYPES.REQUIREMENT,
      title: "Ready requirement",
      content: {
        requirement: "The system shall expose a ready dashboard.",
        acceptance_criteria: ["Dashboard shows the ready gate state."]
      },
      ownerId: engineeringLead.id
    },
    programManager
  );
  const testObject = service.createDecisionObject(
    "project-dashboard-ready",
    {
      type: DECISION_OBJECT_TYPES.TEST,
      title: "Ready dashboard acceptance criteria",
      content: { acceptance_criteria: ["Ready state is visible."] },
      ownerId: engineeringLead.id
    },
    programManager
  );

  service.createTraceLink(
    "project-dashboard-ready",
    requirement.decisionObject.objectId,
    {
      targetObjectId: workflow.decisionObject.objectId,
      relationshipType: "derived_from"
    },
    programManager
  );
  service.createTraceLink(
    "project-dashboard-ready",
    requirement.decisionObject.objectId,
    {
      targetObjectId: testObject.decisionObject.objectId,
      relationshipType: "validated_by"
    },
    programManager
  );
  service.submitApproval(
    "project-dashboard-ready",
    workflow.decisionObject.objectId,
    { version: 1, approvalDecision: "approved", comment: "Workflow is ready." },
    operatorRepresentative
  );
  service.submitApproval(
    "project-dashboard-ready",
    requirement.decisionObject.objectId,
    { version: 1, approvalDecision: "approved", comment: "Requirement is ready." },
    customerPm
  );

  const dashboard = service.getReadinessDashboard("project-dashboard-ready");

  assert.equal(dashboard.status, READINESS_STATUSES.READY);
  assert.equal(dashboard.readinessScore, 100);
  assert.equal(dashboard.hardBlockers.length, 0);
  assert.equal(dashboard.pendingApprovalCount, 0);
  assert.equal(dashboard.jiraExportDisabled, false);
});
