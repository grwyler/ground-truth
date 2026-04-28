import test from "node:test";
import assert from "node:assert/strict";
import {
  MVP_SCHEMA_VERSION,
  createMvpSeedData,
  getRequiredColumns,
  listMvpTableNames,
  validateMvpSeedData
} from "../../../packages/db/src/index.js";
import {
  BLOCKER_STATUSES,
  DECISION_OBJECT_TYPES
} from "../../../packages/domain/src/index.js";

const expectedTables = [
  "projects",
  "documents",
  "ai_generation_jobs",
  "decision_objects",
  "decision_object_versions",
  "trace_links",
  "approvals",
  "readiness_evaluations",
  "blockers",
  "overrides",
  "certification_packages",
  "jira_exports",
  "users",
  "role_assignments",
  "audit_events"
];

test("MVP schema declares every required persistence collection", () => {
  assert.equal(typeof MVP_SCHEMA_VERSION, "string");
  assert.deepEqual(listMvpTableNames(), expectedTables);
});

test("MVP schema records mandatory fields for core gate entities", () => {
  assert.deepEqual(getRequiredColumns("projects"), [
    "project_id",
    "name",
    "status",
    "readiness_status",
    "created_by",
    "created_at",
    "updated_at"
  ]);
  assert.ok(getRequiredColumns("decision_objects").includes("owner_id"));
  assert.ok(getRequiredColumns("decision_object_versions").includes("content"));
  assert.ok(getRequiredColumns("trace_links").includes("required_for_readiness"));
  assert.ok(getRequiredColumns("approvals").includes("version_id"));
  assert.ok(getRequiredColumns("blockers").includes("severity"));
  assert.ok(getRequiredColumns("overrides").includes("risk_acknowledgment"));
});

test("MVP seed data contains required records and validates cleanly", () => {
  const seedData = createMvpSeedData();
  const validation = validateMvpSeedData(seedData);

  assert.equal(validation.valid, true);
  assert.deepEqual(validation.errors, []);
  assert.equal(seedData.projects.length, 1);
  assert.ok(seedData.documents.length >= 2);
  assert.ok(seedData.decisionObjects.length >= 4);
  assert.ok(seedData.roleAssignments.length >= 5);
  assert.ok(seedData.auditEvents.length >= 1);
});

test("seed requirements include workflow and test traceability", () => {
  const seedData = createMvpSeedData();
  const workflowIds = new Set(
    seedData.decisionObjects
      .filter((object) => object.type === DECISION_OBJECT_TYPES.WORKFLOW)
      .map((object) => object.object_id)
  );
  const testIds = new Set(
    seedData.decisionObjects
      .filter((object) => object.type === DECISION_OBJECT_TYPES.TEST)
      .map((object) => object.object_id)
  );
  const requirementIds = seedData.decisionObjects
    .filter((object) => object.type === DECISION_OBJECT_TYPES.REQUIREMENT)
    .map((object) => object.object_id);

  assert.ok(
    requirementIds.some((requirementId) =>
      seedData.traceLinks.some(
        (link) => link.source_object_id === requirementId && workflowIds.has(link.target_object_id)
      )
    )
  );
  assert.ok(
    requirementIds.some((requirementId) =>
      seedData.traceLinks.some(
        (link) => link.source_object_id === requirementId && testIds.has(link.target_object_id)
      )
    )
  );
});

test("approvals reference immutable versions and overrides reference blockers", () => {
  const seedData = createMvpSeedData();
  const versionIds = new Set(
    seedData.decisionObjectVersions.map((version) => version.version_id)
  );
  const blockerIds = new Set(seedData.blockers.map((blocker) => blocker.blocker_id));

  assert.ok(seedData.approvals.every((approval) => versionIds.has(approval.version_id)));
  assert.ok(
    seedData.overrides.every((override) =>
      override.blocker_ids.every((blockerId) => blockerIds.has(blockerId))
    )
  );
  assert.ok(
    seedData.blockers.some((blocker) => blocker.status === BLOCKER_STATUSES.OPEN),
    "seed should include active blockers for future readiness work"
  );
});
