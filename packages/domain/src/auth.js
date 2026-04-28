import { MVP_ROLES, ROLE_LABELS, isHumanRole, isMvpRole } from "./roles.js";

export const ACTOR_TYPES = Object.freeze({
  HUMAN: "human",
  SYSTEM: "system"
});

export const PERMISSIONS = Object.freeze({
  READ_PROJECT: "project:read",
  MANAGE_PROJECT: "project:manage",
  EDIT_PROJECT: "project:edit",
  APPROVE_DECISION: "decision:approve",
  REJECT_DECISION: "decision:reject",
  REQUEST_CHANGES: "decision:request_changes",
  SUBMIT_OVERRIDE: "override:submit",
  EXPORT_JIRA: "jira:export",
  GENERATE_AI_DRAFT: "ai:generate_draft"
});

const ROLE_PERMISSIONS = Object.freeze({
  [MVP_ROLES.PROGRAM_MANAGER]: Object.freeze([
    PERMISSIONS.READ_PROJECT,
    PERMISSIONS.MANAGE_PROJECT,
    PERMISSIONS.EDIT_PROJECT,
    PERMISSIONS.APPROVE_DECISION,
    PERMISSIONS.REJECT_DECISION,
    PERMISSIONS.REQUEST_CHANGES,
    PERMISSIONS.SUBMIT_OVERRIDE,
    PERMISSIONS.EXPORT_JIRA,
    PERMISSIONS.GENERATE_AI_DRAFT
  ]),
  [MVP_ROLES.ENGINEERING_LEAD]: Object.freeze([
    PERMISSIONS.READ_PROJECT,
    PERMISSIONS.EDIT_PROJECT,
    PERMISSIONS.APPROVE_DECISION,
    PERMISSIONS.REJECT_DECISION,
    PERMISSIONS.REQUEST_CHANGES,
    PERMISSIONS.EXPORT_JIRA
  ]),
  [MVP_ROLES.OPERATOR_REPRESENTATIVE]: Object.freeze([
    PERMISSIONS.READ_PROJECT,
    PERMISSIONS.EDIT_PROJECT,
    PERMISSIONS.APPROVE_DECISION,
    PERMISSIONS.REJECT_DECISION,
    PERMISSIONS.REQUEST_CHANGES
  ]),
  [MVP_ROLES.CUSTOMER_PM]: Object.freeze([
    PERMISSIONS.READ_PROJECT,
    PERMISSIONS.APPROVE_DECISION,
    PERMISSIONS.REJECT_DECISION,
    PERMISSIONS.REQUEST_CHANGES
  ]),
  [MVP_ROLES.EXECUTIVE_VIEWER]: Object.freeze([PERMISSIONS.READ_PROJECT]),
  [MVP_ROLES.AI_SYSTEM]: Object.freeze([PERMISSIONS.GENERATE_AI_DRAFT])
});

export const SEEDED_MVP_USERS = Object.freeze([
  Object.freeze({
    id: "user-pm-001",
    displayName: "Priya Morgan",
    email: "pm@example.local",
    actorType: ACTOR_TYPES.HUMAN,
    role: MVP_ROLES.PROGRAM_MANAGER,
    roleLabel: ROLE_LABELS[MVP_ROLES.PROGRAM_MANAGER]
  }),
  Object.freeze({
    id: "user-eng-001",
    displayName: "Evan Brooks",
    email: "engineering@example.local",
    actorType: ACTOR_TYPES.HUMAN,
    role: MVP_ROLES.ENGINEERING_LEAD,
    roleLabel: ROLE_LABELS[MVP_ROLES.ENGINEERING_LEAD]
  }),
  Object.freeze({
    id: "user-operator-001",
    displayName: "Olivia Reyes",
    email: "operator@example.local",
    actorType: ACTOR_TYPES.HUMAN,
    role: MVP_ROLES.OPERATOR_REPRESENTATIVE,
    roleLabel: ROLE_LABELS[MVP_ROLES.OPERATOR_REPRESENTATIVE]
  }),
  Object.freeze({
    id: "user-customer-pm-001",
    displayName: "Chris Patel",
    email: "customer-pm@example.local",
    actorType: ACTOR_TYPES.HUMAN,
    role: MVP_ROLES.CUSTOMER_PM,
    roleLabel: ROLE_LABELS[MVP_ROLES.CUSTOMER_PM]
  }),
  Object.freeze({
    id: "user-exec-viewer-001",
    displayName: "Elena Foster",
    email: "executive@example.local",
    actorType: ACTOR_TYPES.HUMAN,
    role: MVP_ROLES.EXECUTIVE_VIEWER,
    roleLabel: ROLE_LABELS[MVP_ROLES.EXECUTIVE_VIEWER]
  })
]);

export const AI_SYSTEM_ACTOR = Object.freeze({
  id: "system-ai-assistant",
  displayName: "AI Assistant/System",
  email: null,
  actorType: ACTOR_TYPES.SYSTEM,
  role: MVP_ROLES.AI_SYSTEM,
  roleLabel: ROLE_LABELS[MVP_ROLES.AI_SYSTEM]
});

export const SEEDED_ROLE_ASSIGNMENTS = Object.freeze(
  SEEDED_MVP_USERS.map((user) =>
    Object.freeze({
      id: `role-${user.id}`,
      userId: user.id,
      projectId: "seed-project",
      role: user.role
    })
  )
);

export function listSeededActors() {
  return Object.freeze([...SEEDED_MVP_USERS, AI_SYSTEM_ACTOR]);
}

export function findSeededActorById(actorId) {
  return listSeededActors().find((actor) => actor.id === actorId) ?? null;
}

export function normalizeActor(actor) {
  if (!actor || !isMvpRole(actor.role)) {
    return null;
  }

  const actorType =
    actor.actorType ?? (isHumanRole(actor.role) ? ACTOR_TYPES.HUMAN : ACTOR_TYPES.SYSTEM);

  return Object.freeze({
    ...actor,
    actorType,
    roleLabel: actor.roleLabel ?? ROLE_LABELS[actor.role]
  });
}

export function actorHasPermission(actor, permission) {
  const normalizedActor = normalizeActor(actor);

  if (!normalizedActor) {
    return false;
  }

  if (normalizedActor.actorType !== ACTOR_TYPES.HUMAN && isHumanDecisionPermission(permission)) {
    return false;
  }

  return ROLE_PERMISSIONS[normalizedActor.role]?.includes(permission) ?? false;
}

export function authorize(actor, permission) {
  return Object.freeze({
    allowed: actorHasPermission(actor, permission),
    actor: normalizeActor(actor),
    permission
  });
}

export function isHumanDecisionPermission(permission) {
  return [
    PERMISSIONS.APPROVE_DECISION,
    PERMISSIONS.REJECT_DECISION,
    PERMISSIONS.REQUEST_CHANGES,
    PERMISSIONS.SUBMIT_OVERRIDE
  ].includes(permission);
}

export const canReadProject = (actor) => actorHasPermission(actor, PERMISSIONS.READ_PROJECT);
export const canManageProject = (actor) => actorHasPermission(actor, PERMISSIONS.MANAGE_PROJECT);
export const canEditProject = (actor) => actorHasPermission(actor, PERMISSIONS.EDIT_PROJECT);
export const canApprove = (actor) => actorHasPermission(actor, PERMISSIONS.APPROVE_DECISION);
export const canReject = (actor) => actorHasPermission(actor, PERMISSIONS.REJECT_DECISION);
export const canRequestChanges = (actor) =>
  actorHasPermission(actor, PERMISSIONS.REQUEST_CHANGES);
export const canSubmitOverride = (actor) =>
  actorHasPermission(actor, PERMISSIONS.SUBMIT_OVERRIDE);
export const canExportToJira = (actor) => actorHasPermission(actor, PERMISSIONS.EXPORT_JIRA);
