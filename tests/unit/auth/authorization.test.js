import test from "node:test";
import assert from "node:assert/strict";
import {
  AI_SYSTEM_ACTOR,
  MVP_ROLES,
  PERMISSIONS,
  SEEDED_MVP_USERS,
  actorHasPermission,
  canApprove,
  canEditProject,
  canExportToJira,
  canManageProject,
  canReadProject,
  canReject,
  canRequestChanges,
  canSubmitOverride,
  findSeededActorById,
  listSeededActors
} from "../../../packages/domain/src/index.js";

const usersByRole = new Map(SEEDED_MVP_USERS.map((user) => [user.role, user]));

test("seeded local auth includes all MVP human roles and the AI/System actor", () => {
  assert.equal(usersByRole.size, 5);
  assert.ok(usersByRole.has(MVP_ROLES.PROGRAM_MANAGER));
  assert.ok(usersByRole.has(MVP_ROLES.ENGINEERING_LEAD));
  assert.ok(usersByRole.has(MVP_ROLES.OPERATOR_REPRESENTATIVE));
  assert.ok(usersByRole.has(MVP_ROLES.CUSTOMER_PM));
  assert.ok(usersByRole.has(MVP_ROLES.EXECUTIVE_VIEWER));
  assert.equal(findSeededActorById(AI_SYSTEM_ACTOR.id), AI_SYSTEM_ACTOR);
  assert.equal(listSeededActors().length, 6);
});

test("PM can manage project work and submit overrides", () => {
  const pm = usersByRole.get(MVP_ROLES.PROGRAM_MANAGER);

  assert.equal(canReadProject(pm), true);
  assert.equal(canManageProject(pm), true);
  assert.equal(canEditProject(pm), true);
  assert.equal(canApprove(pm), true);
  assert.equal(canSubmitOverride(pm), true);
  assert.equal(canExportToJira(pm), true);
});

test("Executive Viewer is read-only", () => {
  const executiveViewer = usersByRole.get(MVP_ROLES.EXECUTIVE_VIEWER);

  assert.equal(canReadProject(executiveViewer), true);
  assert.equal(canManageProject(executiveViewer), false);
  assert.equal(canEditProject(executiveViewer), false);
  assert.equal(canApprove(executiveViewer), false);
  assert.equal(canReject(executiveViewer), false);
  assert.equal(canRequestChanges(executiveViewer), false);
  assert.equal(canSubmitOverride(executiveViewer), false);
  assert.equal(canExportToJira(executiveViewer), false);
});

test("role permissions deny unauthorized override and export actions", () => {
  const engineeringLead = usersByRole.get(MVP_ROLES.ENGINEERING_LEAD);
  const operatorRepresentative = usersByRole.get(MVP_ROLES.OPERATOR_REPRESENTATIVE);
  const customerPm = usersByRole.get(MVP_ROLES.CUSTOMER_PM);

  assert.equal(canSubmitOverride(engineeringLead), false);
  assert.equal(canSubmitOverride(operatorRepresentative), false);
  assert.equal(canSubmitOverride(customerPm), false);
  assert.equal(canExportToJira(operatorRepresentative), false);
  assert.equal(canExportToJira(customerPm), false);
});

test("AI/System actor can generate drafts but cannot take human decision actions", () => {
  assert.equal(actorHasPermission(AI_SYSTEM_ACTOR, PERMISSIONS.GENERATE_AI_DRAFT), true);
  assert.equal(canApprove(AI_SYSTEM_ACTOR), false);
  assert.equal(canReject(AI_SYSTEM_ACTOR), false);
  assert.equal(canRequestChanges(AI_SYSTEM_ACTOR), false);
  assert.equal(canSubmitOverride(AI_SYSTEM_ACTOR), false);
  assert.equal(canExportToJira(AI_SYSTEM_ACTOR), false);
});
