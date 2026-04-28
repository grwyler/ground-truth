import { AUDIT_EVENT_TYPES, DECISION_OBJECT_STATUSES } from "./models/index.js";

export const OWNERSHIP_ERRORS = Object.freeze({
  OBJECT_REQUIRED: "OWNERSHIP_OBJECT_REQUIRED",
  OWNER_REQUIRED: "OWNERSHIP_OWNER_REQUIRED",
  OWNER_NOT_ASSIGNABLE: "OWNERSHIP_OWNER_NOT_ASSIGNABLE",
  STATUS_NOT_ASSIGNABLE: "OWNERSHIP_STATUS_NOT_ASSIGNABLE"
});

const ASSIGNABLE_STATUSES = Object.freeze([
  DECISION_OBJECT_STATUSES.DRAFT,
  DECISION_OBJECT_STATUSES.IN_REVIEW
]);

export function buildOwnerAssignment(
  decisionObject,
  input = {},
  actor,
  { assignableOwners = [], now = new Date() } = {}
) {
  const errors = [];
  const ownerId = normalizeRequiredString(input.ownerId ?? input.owner_id);

  if (!decisionObject) {
    errors.push(OWNERSHIP_ERRORS.OBJECT_REQUIRED);
  }

  if (!ownerId) {
    errors.push(OWNERSHIP_ERRORS.OWNER_REQUIRED);
  }

  if (decisionObject && !ASSIGNABLE_STATUSES.includes(decisionObject.status)) {
    errors.push(OWNERSHIP_ERRORS.STATUS_NOT_ASSIGNABLE);
  }

  if (ownerId && !assignableOwners.some((owner) => owner.userId === ownerId)) {
    errors.push(OWNERSHIP_ERRORS.OWNER_NOT_ASSIGNABLE);
  }

  if (errors.length > 0) {
    return Object.freeze({
      ok: false,
      validation: freezeValidation(errors)
    });
  }

  return Object.freeze({
    ok: true,
    decisionObject: Object.freeze({
      ...decisionObject,
      owner_id: ownerId,
      updated_at: now.toISOString()
    }),
    previousOwnerId: decisionObject.owner_id,
    ownerId,
    assignedBy: actor.id
  });
}

export function buildOwnerAssignmentAuditEvent(
  assignment,
  actor,
  { idGenerator, now = new Date() } = {}
) {
  return Object.freeze({
    audit_event_id:
      idGenerator?.() ??
      `audit-${assignment.decisionObject.object_id}-owner-${Date.now()}`,
    project_id: assignment.decisionObject.project_id,
    actor_id: actor.id,
    event_type: AUDIT_EVENT_TYPES.UPDATE,
    entity_type: "decision_object",
    entity_id: assignment.decisionObject.object_id,
    timestamp: now.toISOString(),
    details: Object.freeze({
      review_status: "owner_assigned",
      object_status: assignment.decisionObject.status,
      previous_owner_id: assignment.previousOwnerId,
      owner_id: assignment.ownerId,
      assigned_by: assignment.assignedBy
    }),
    immutable_hash: null
  });
}

export function toAssignableOwnerSummary(user, roleAssignment) {
  return Object.freeze({
    userId: user.user_id,
    displayName: user.name,
    email: user.email,
    role: roleAssignment.role
  });
}

function normalizeRequiredString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function freezeValidation(errors) {
  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze([...new Set(errors)])
  });
}
