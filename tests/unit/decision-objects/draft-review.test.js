import test from "node:test";
import assert from "node:assert/strict";
import {
  DRAFT_REVIEW_STATUSES,
  DECISION_OBJECT_STATUSES,
  SEEDED_MVP_USERS,
  acceptDecisionDraft,
  buildDecisionObjectUpdate,
  rejectDecisionDraft
} from "../../../packages/domain/src/index.js";

const pm = SEEDED_MVP_USERS[0];
const decisionObject = {
  object_id: "obj-draft-1",
  project_id: "project-draft-review",
  type: "requirement",
  title: "Original generated requirement",
  current_version: 1,
  status: DECISION_OBJECT_STATUSES.DRAFT,
  owner_id: null,
  priority: "high",
  created_by: "system-ai-assistant",
  created_at: "2026-04-28T12:00:00.000Z",
  updated_at: "2026-04-28T12:00:00.000Z"
};
const version = {
  version_id: "ver-draft-1",
  object_id: "obj-draft-1",
  version_number: 1,
  content: {
    requirement: "Generated requirement text.",
    acceptance_criteria: ["Review generated content"],
    ai_generated: true,
    source_document_ids: ["doc-source-1"]
  },
  change_reason: "Initial AI-generated draft candidate.",
  changed_by: "system-ai-assistant",
  created_at: "2026-04-28T12:00:00.000Z",
  meaningful_change: true
};

test("draft review update edits title and current draft content", () => {
  const result = buildDecisionObjectUpdate(
    decisionObject,
    version,
    {
      title: "Reviewed generated requirement",
      content: {
        requirement: "Reviewed requirement text."
      },
      changeReason: "PM clarified the generated wording."
    },
    pm,
    {
      now: new Date("2026-04-28T13:00:00.000Z")
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.decisionObject.title, "Reviewed generated requirement");
  assert.equal(result.decisionObject.updated_at, "2026-04-28T13:00:00.000Z");
  assert.equal(result.version.content.requirement, "Reviewed requirement text.");
  assert.equal(result.version.content.ai_generated, true);
  assert.equal(result.version.content.ai_review_status, DRAFT_REVIEW_STATUSES.SUGGESTED);
  assert.equal(result.version.changed_by, pm.id);
});

test("accepting a draft keeps it active in Draft status", () => {
  const result = acceptDecisionDraft(decisionObject, version, pm, {
    now: new Date("2026-04-28T13:05:00.000Z")
  });

  assert.equal(result.ok, true);
  assert.equal(result.decisionObject.status, DECISION_OBJECT_STATUSES.DRAFT);
  assert.equal(result.version.content.ai_review_status, DRAFT_REVIEW_STATUSES.ACCEPTED);
  assert.equal(result.version.changed_by, pm.id);
});

test("rejecting a draft excludes it from future readiness computation", () => {
  const result = rejectDecisionDraft(decisionObject, version, pm, {
    now: new Date("2026-04-28T13:10:00.000Z")
  });

  assert.equal(result.ok, true);
  assert.equal(result.decisionObject.status, DECISION_OBJECT_STATUSES.REJECTED);
  assert.equal(result.version.content.ai_review_status, DRAFT_REVIEW_STATUSES.REJECTED);
});
