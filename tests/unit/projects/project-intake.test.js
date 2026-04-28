import test from "node:test";
import assert from "node:assert/strict";
import {
  PROJECT_STATUSES,
  PROJECT_VALIDATION_ERRORS,
  READINESS_STATUSES,
  SEEDED_MVP_USERS,
  buildProjectRecord,
  validateProjectIntake
} from "../../../packages/domain/src/index.js";
import { createInMemoryProjectRepository } from "../../../packages/db/src/index.js";

const pm = SEEDED_MVP_USERS[0];

test("project intake requires a project name", () => {
  const validation = validateProjectIntake({ name: " " });

  assert.equal(validation.valid, false);
  assert.deepEqual(validation.errors, [PROJECT_VALIDATION_ERRORS.NAME_REQUIRED]);
});

test("project intake initializes projects in Draft and Not Ready state", () => {
  const result = buildProjectRecord(
    {
      name: "New Mobilization",
      customer: "Acme"
    },
    pm,
    {
      now: new Date("2026-04-28T14:00:00.000Z"),
      idGenerator: () => "project-new"
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.project.project_id, "project-new");
  assert.equal(result.project.name, "New Mobilization");
  assert.equal(result.project.status, PROJECT_STATUSES.DRAFT);
  assert.equal(result.project.readiness_status, READINESS_STATUSES.NOT_READY);
  assert.equal(result.project.readiness_score, 0);
  assert.equal(result.project.created_by, pm.id);
});

test("project repository persists created projects and audit events", () => {
  const repository = createInMemoryProjectRepository({
    projects: [],
    auditEvents: []
  });
  const project = {
    project_id: "project-new",
    name: "New Mobilization",
    description: null,
    customer: null,
    contract_number: null,
    program_name: null,
    status: PROJECT_STATUSES.DRAFT,
    readiness_status: READINESS_STATUSES.NOT_READY,
    readiness_score: 0,
    created_by: pm.id,
    created_at: "2026-04-28T14:00:00.000Z",
    updated_at: "2026-04-28T14:00:00.000Z"
  };
  const auditEvent = {
    audit_event_id: "audit-project-new-create",
    project_id: "project-new",
    actor_id: pm.id,
    event_type: "create",
    entity_type: "project",
    entity_id: "project-new",
    timestamp: "2026-04-28T14:00:00.000Z",
    details: { name: "New Mobilization" },
    immutable_hash: null
  };

  repository.createProject(project, auditEvent);

  assert.equal(repository.listProjects().length, 1);
  assert.equal(repository.findProjectById("project-new").name, "New Mobilization");
  assert.equal(repository.listAuditEvents("project-new").length, 1);
});
