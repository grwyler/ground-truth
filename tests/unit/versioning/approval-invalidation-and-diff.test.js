import test from "node:test";
import assert from "node:assert/strict";
import {
  APPROVAL_STATUSES,
  SEEDED_MVP_USERS,
  VERSION_DIFF_CHANGE_TYPES,
  buildApprovalInvalidations,
  buildVersionDiff
} from "../../../packages/domain/src/index.js";

const pm = SEEDED_MVP_USERS[0];
const decisionObject = {
  object_id: "obj-version-diff",
  project_id: "project-version-diff",
  type: "requirement",
  title: "Timestamped photo evidence",
  current_version: 2,
  status: "draft",
  owner_id: "user-eng-001",
  priority: "high",
  created_by: "user-pm-001",
  created_at: "2026-04-28T12:00:00.000Z",
  updated_at: "2026-04-28T13:00:00.000Z"
};
const previousVersion = {
  version_id: "ver-photo-1",
  object_id: decisionObject.object_id,
  version_number: 1,
  content: {
    requirement: "The system shall capture photo evidence.",
    acceptance_criteria: ["Photo remains linked to the intake record."]
  },
  change_reason: "Approved baseline.",
  changed_by: "user-customer-pm-001",
  created_at: "2026-04-28T12:00:00.000Z",
  meaningful_change: true
};
const nextVersion = {
  version_id: "ver-photo-2",
  object_id: decisionObject.object_id,
  version_number: 2,
  content: {
    requirement: "The system shall capture timestamped photo evidence.",
    acceptance_criteria: [
      "Photo remains linked to the intake record.",
      "Photo metadata includes capture time."
    ]
  },
  change_reason: "Clarified timestamp expectation.",
  changed_by: "user-pm-001",
  created_at: "2026-04-28T13:00:00.000Z",
  meaningful_change: true
};

test("meaningful version changes invalidate active approvals for the changed object only", () => {
  const result = buildApprovalInvalidations(
    [
      activeApproval("approval-photo", decisionObject.object_id, previousVersion.version_id),
      activeApproval("approval-other", "obj-unrelated", "ver-other-1"),
      {
        ...activeApproval("approval-old-invalidated", decisionObject.object_id, previousVersion.version_id),
        status: APPROVAL_STATUSES.INVALIDATED
      }
    ],
    decisionObject,
    previousVersion,
    nextVersion,
    pm,
    {
      now: new Date("2026-04-28T13:05:00.000Z"),
      idGenerator: (kind) => `generated-${kind}`
    }
  );

  assert.equal(result.invalidatedApprovals.length, 1);
  assert.equal(result.invalidatedApprovals[0].approval_id, "approval-photo");
  assert.equal(result.invalidatedApprovals[0].status, APPROVAL_STATUSES.INVALIDATED);
  assert.equal(
    result.invalidatedApprovals[0].invalidation_reason,
    "Version 1 was superseded by version 2 after a meaningful content change."
  );
  assert.equal(result.auditEvents.length, 1);
});

test("version diff returns field-level content changes between two versions", () => {
  const result = buildVersionDiff(decisionObject, previousVersion, nextVersion);

  assert.equal(result.ok, true);
  assert.equal(result.diff.objectId, decisionObject.object_id);
  assert.equal(result.diff.fromVersion, 1);
  assert.equal(result.diff.toVersion, 2);
  assert.deepEqual(
    result.diff.changes.map((change) => [change.field, change.changeType]),
    [
      ["content.acceptance_criteria", VERSION_DIFF_CHANGE_TYPES.MODIFIED],
      ["content.requirement", VERSION_DIFF_CHANGE_TYPES.MODIFIED]
    ]
  );
});

function activeApproval(approvalId, objectId, versionId) {
  return {
    approval_id: approvalId,
    object_id: objectId,
    version_id: versionId,
    approver_id: "user-customer-pm-001",
    decision: "approved",
    comment: "Approved.",
    status: APPROVAL_STATUSES.ACTIVE,
    created_at: "2026-04-28T12:00:00.000Z",
    invalidated_at: null,
    invalidation_reason: null
  };
}
