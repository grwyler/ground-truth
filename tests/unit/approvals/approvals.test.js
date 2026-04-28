import test from "node:test";
import assert from "node:assert/strict";
import {
  AI_SYSTEM_ACTOR,
  APPROVAL_DECISIONS,
  APPROVAL_ERRORS,
  DECISION_OBJECT_STATUSES,
  DECISION_OBJECT_TYPES,
  MVP_ROLES,
  SEEDED_MVP_USERS,
  buildApprovalDecision,
  canActorApproveDecisionObject,
  getRequiredApproverRole
} from "../../../packages/domain/src/index.js";
import { createLocalAiGenerationService } from "../../../apps/web/src/main.js";

const operator = SEEDED_MVP_USERS.find(
  (user) => user.role === MVP_ROLES.OPERATOR_REPRESENTATIVE
);
const customerPm = SEEDED_MVP_USERS.find((user) => user.role === MVP_ROLES.CUSTOMER_PM);
const engineeringLead = SEEDED_MVP_USERS.find(
  (user) => user.role === MVP_ROLES.ENGINEERING_LEAD
);
const executiveViewer = SEEDED_MVP_USERS.find(
  (user) => user.role === MVP_ROLES.EXECUTIVE_VIEWER
);

test("approval authority is role-specific by decision object type", () => {
  assert.equal(getRequiredApproverRole(decisionObject("workflow")), MVP_ROLES.OPERATOR_REPRESENTATIVE);
  assert.equal(getRequiredApproverRole(decisionObject("requirement")), MVP_ROLES.CUSTOMER_PM);
  assert.equal(getRequiredApproverRole(decisionObject("test")), MVP_ROLES.ENGINEERING_LEAD);

  assert.equal(canActorApproveDecisionObject(operator, decisionObject("workflow")), true);
  assert.equal(canActorApproveDecisionObject(customerPm, decisionObject("requirement")), true);
  assert.equal(canActorApproveDecisionObject(engineeringLead, decisionObject("test")), true);
  assert.equal(canActorApproveDecisionObject(executiveViewer, decisionObject("requirement")), false);
  assert.equal(canActorApproveDecisionObject(AI_SYSTEM_ACTOR, decisionObject("workflow")), false);
});

test("assigned approver can approve the current immutable version", () => {
  const result = buildApprovalDecision(
    decisionObject(DECISION_OBJECT_TYPES.REQUIREMENT),
    version(),
    {
      version: 1,
      approvalDecision: "Approved",
      comment: "Requirement is ready."
    },
    customerPm,
    {
      now: new Date("2026-04-28T13:00:00.000Z"),
      idGenerator: (kind) => `approval-test-${kind}`
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.approval.approval_id, "approval-test-approval");
  assert.equal(result.approval.decision, APPROVAL_DECISIONS.APPROVED);
  assert.equal(result.approval.version_id, "ver-approval-object-1");
  assert.equal(result.decisionObject.status, DECISION_OBJECT_STATUSES.APPROVED);
});

test("reject and request changes decisions require comments", () => {
  const rejected = buildApprovalDecision(
    decisionObject(DECISION_OBJECT_TYPES.REQUIREMENT),
    version(),
    { approvalDecision: "Rejected" },
    customerPm
  );
  const changesRequested = buildApprovalDecision(
    decisionObject(DECISION_OBJECT_TYPES.REQUIREMENT),
    version(),
    { approvalDecision: "changes_requested" },
    customerPm
  );

  assert.equal(rejected.ok, false);
  assert.ok(rejected.validation.errors.includes(APPROVAL_ERRORS.COMMENT_REQUIRED));
  assert.equal(changesRequested.ok, false);
  assert.ok(changesRequested.validation.errors.includes(APPROVAL_ERRORS.COMMENT_REQUIRED));
});

test("approval must target the current version and a permitted human approver", () => {
  const wrongVersion = buildApprovalDecision(
    decisionObject(DECISION_OBJECT_TYPES.WORKFLOW),
    version(),
    { version: 2, approvalDecision: "approved" },
    operator
  );
  const unauthorized = buildApprovalDecision(
    decisionObject(DECISION_OBJECT_TYPES.WORKFLOW),
    version(),
    { version: 1, approvalDecision: "approved" },
    customerPm
  );

  assert.deepEqual(wrongVersion.validation.errors, [APPROVAL_ERRORS.VERSION_MISMATCH]);
  assert.deepEqual(unauthorized.validation.errors, [APPROVAL_ERRORS.UNAUTHORIZED_APPROVER]);
});

test("local workspace approval queue records decisions and removes approved items", () => {
  const service = createLocalAiGenerationService();
  const created = service.createDecisionObject(
    "project-local-approval",
    {
      type: DECISION_OBJECT_TYPES.WORKFLOW,
      title: "Local workflow approval",
      content: { summary: "Operator validates the workflow." }
    },
    operator
  );

  assert.equal(created.ok, true);
  const queue = service.listApprovalQueue("project-local-approval", operator);

  assert.equal(queue.length, 1);
  assert.equal(queue[0].traceabilityStatus, "Traceability is not required for this object type.");

  const approved = service.submitApproval(
    "project-local-approval",
    created.decisionObject.objectId,
    {
      version: 1,
      approvalDecision: "approved",
      comment: "Looks right."
    },
    operator
  );

  assert.equal(approved.ok, true);
  assert.equal(approved.decisionObject.status, DECISION_OBJECT_STATUSES.APPROVED);
  assert.equal(service.listApprovalQueue("project-local-approval", operator).length, 0);
  assert.equal(service.listApprovals("project-local-approval").length, 1);
});

function decisionObject(type) {
  return {
    object_id: "obj-approval",
    project_id: "project-approval",
    type,
    title: "Approval object",
    current_version: 1,
    status: DECISION_OBJECT_STATUSES.IN_REVIEW,
    owner_id: "user-eng-001",
    priority: "high",
    created_by: "system-ai-assistant",
    created_at: "2026-04-28T12:00:00.000Z",
    updated_at: "2026-04-28T12:00:00.000Z"
  };
}

function version() {
  return {
    version_id: "ver-approval-object-1",
    object_id: "obj-approval",
    version_number: 1,
    content: { requirement: "Requirement under approval." },
    change_reason: "Ready for approval.",
    changed_by: "user-eng-001",
    created_at: "2026-04-28T12:00:00.000Z",
    meaningful_change: true
  };
}
