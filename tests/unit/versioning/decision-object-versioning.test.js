import test from "node:test";
import assert from "node:assert/strict";
import {
  DECISION_OBJECT_ERRORS,
  DECISION_OBJECT_STATUSES,
  SEEDED_MVP_USERS,
  buildDecisionObjectCreate,
  buildDecisionObjectUpdate,
  isMeaningfulDecisionObjectChange
} from "../../../packages/domain/src/index.js";

const pm = SEEDED_MVP_USERS[0];
const decisionObject = {
  object_id: "obj-versioned-1",
  project_id: "project-versioning",
  type: "requirement",
  title: "Original requirement",
  current_version: 1,
  status: DECISION_OBJECT_STATUSES.APPROVED,
  owner_id: "user-eng-001",
  priority: "high",
  created_by: "user-pm-001",
  created_at: "2026-04-28T12:00:00.000Z",
  updated_at: "2026-04-28T12:00:00.000Z"
};
const version = {
  version_id: "ver-versioned-1",
  object_id: "obj-versioned-1",
  version_number: 1,
  content: {
    requirement: "The system shall capture field intake photos.",
    acceptance_criteria: ["Photo metadata is stored."]
  },
  change_reason: "Approved baseline.",
  changed_by: "user-pm-001",
  created_at: "2026-04-28T12:00:00.000Z",
  meaningful_change: true
};

test("decision object creation starts at version one with immutable content", () => {
  const result = buildDecisionObjectCreate(
    {
      projectId: "project-versioning",
      type: "workflow",
      title: "Operator intake",
      content: {
        summary: "Operator captures field details."
      },
      ownerId: "user-operator-001"
    },
    pm,
    {
      now: new Date("2026-04-28T13:00:00.000Z"),
      idGenerator: (kind) => `created-${kind}`
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.decisionObject.current_version, 1);
  assert.equal(result.version.version_number, 1);
  assert.equal(result.version.version_id, "created-version");
  assert.equal(result.version.content.summary, "Operator captures field details.");
});

test("meaningful content edits create a new version and leave the prior version unchanged", () => {
  const result = buildDecisionObjectUpdate(
    decisionObject,
    version,
    {
      content: {
        requirement: "The system shall capture timestamped field intake photos.",
        acceptance_criteria: ["Photo metadata is stored."]
      },
      changeReason: "Clarified timestamp expectation."
    },
    pm,
    {
      now: new Date("2026-04-28T13:05:00.000Z"),
      idGenerator: (kind) => `updated-${kind}`
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.meaningfulChange, true);
  assert.equal(result.decisionObject.current_version, 2);
  assert.equal(result.decisionObject.status, DECISION_OBJECT_STATUSES.DRAFT);
  assert.equal(result.version.version_id, "updated-version");
  assert.equal(result.version.version_number, 2);
  assert.equal(
    version.content.requirement,
    "The system shall capture field intake photos."
  );
});

test("metadata-only edits do not create unnecessary versions", () => {
  const result = buildDecisionObjectUpdate(
    decisionObject,
    version,
    {
      ownerId: "user-operator-001",
      priority: "medium"
    },
    pm,
    {
      now: new Date("2026-04-28T13:10:00.000Z")
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.meaningfulChange, false);
  assert.equal(result.decisionObject.current_version, 1);
  assert.equal(result.version.version_id, version.version_id);
  assert.equal(result.decisionObject.owner_id, "user-operator-001");
});

test("approved objects require a change reason before meaningful edits", () => {
  const result = buildDecisionObjectUpdate(
    decisionObject,
    version,
    {
      content: {
        requirement: "The system shall capture photos before intake submission.",
        acceptance_criteria: ["Photo metadata is stored."]
      }
    },
    pm,
    {
      hasExistingApprovals: true
    }
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.validation.errors, [
    DECISION_OBJECT_ERRORS.CHANGE_REASON_REQUIRED
  ]);
});

test("meaningful change detection ignores review-only draft metadata", () => {
  assert.equal(
    isMeaningfulDecisionObjectChange(version.content, {
      ...version.content,
      ai_review_status: "accepted"
    }),
    false
  );
});
