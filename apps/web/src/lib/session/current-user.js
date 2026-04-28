import {
  PERMISSIONS,
  SEEDED_MVP_USERS,
  actorHasPermission,
  normalizeActor
} from "../../../../../packages/domain/src/index.js";

const DEFAULT_CURRENT_USER = SEEDED_MVP_USERS[0];

export function createLocalCurrentUser(user = DEFAULT_CURRENT_USER) {
  const actor = normalizeActor(user);

  return Object.freeze({
    actor,
    canReadProject: actorHasPermission(actor, PERMISSIONS.READ_PROJECT),
    canManageProject: actorHasPermission(actor, PERMISSIONS.MANAGE_PROJECT),
    canEditProject: actorHasPermission(actor, PERMISSIONS.EDIT_PROJECT),
    canApprove: actorHasPermission(actor, PERMISSIONS.APPROVE_DECISION),
    canGenerateAiDraft: actorHasPermission(actor, PERMISSIONS.GENERATE_AI_DRAFT),
    canSubmitOverride: actorHasPermission(actor, PERMISSIONS.SUBMIT_OVERRIDE),
    canExportToJira: actorHasPermission(actor, PERMISSIONS.EXPORT_JIRA)
  });
}
