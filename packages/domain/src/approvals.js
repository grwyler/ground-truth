import { actorHasPermission, PERMISSIONS } from "./auth.js";
import {
  APPROVAL_DECISIONS,
  APPROVAL_STATUSES,
  AUDIT_EVENT_TYPES,
  DECISION_OBJECT_STATUSES,
  DECISION_OBJECT_TYPES
} from "./models/index.js";
import { MVP_ROLES } from "./roles.js";

export const APPROVAL_ERRORS = Object.freeze({
  OBJECT_REQUIRED: "APPROVAL_OBJECT_REQUIRED",
  VERSION_REQUIRED: "APPROVAL_VERSION_REQUIRED",
  VERSION_MISMATCH: "APPROVAL_VERSION_MISMATCH",
  DECISION_REQUIRED: "APPROVAL_DECISION_REQUIRED",
  INVALID_DECISION: "APPROVAL_INVALID_DECISION",
  COMMENT_REQUIRED: "APPROVAL_COMMENT_REQUIRED",
  UNAUTHORIZED_APPROVER: "APPROVAL_UNAUTHORIZED_APPROVER"
});

export const REQUIRED_APPROVER_ROLES_BY_TYPE = Object.freeze({
  [DECISION_OBJECT_TYPES.WORKFLOW]: MVP_ROLES.OPERATOR_REPRESENTATIVE,
  [DECISION_OBJECT_TYPES.REQUIREMENT]: MVP_ROLES.CUSTOMER_PM,
  [DECISION_OBJECT_TYPES.TEST]: MVP_ROLES.ENGINEERING_LEAD,
  [DECISION_OBJECT_TYPES.RISK]: MVP_ROLES.PROGRAM_MANAGER
});

export function buildApprovalDecision(
  decisionObject,
  version,
  input = {},
  actor,
  { idGenerator, now = new Date() } = {}
) {
  const decision = normalizeApprovalDecision(input.approvalDecision ?? input.decision);
  const comment = normalizeOptionalString(input.comment);
  const requestedVersionNumber =
    input.versionNumber ?? input.version ?? input.version_number ?? null;
  const errors = [];

  if (!decisionObject) {
    errors.push(APPROVAL_ERRORS.OBJECT_REQUIRED);
  }

  if (!version) {
    errors.push(APPROVAL_ERRORS.VERSION_REQUIRED);
  }

  if (!decision) {
    errors.push(
      input.approvalDecision || input.decision
        ? APPROVAL_ERRORS.INVALID_DECISION
        : APPROVAL_ERRORS.DECISION_REQUIRED
    );
  }

  if (
    version &&
    requestedVersionNumber !== null &&
    Number(requestedVersionNumber) !== version.version_number
  ) {
    errors.push(APPROVAL_ERRORS.VERSION_MISMATCH);
  }

  if (
    [APPROVAL_DECISIONS.REJECTED, APPROVAL_DECISIONS.CHANGES_REQUESTED].includes(decision) &&
    !comment
  ) {
    errors.push(APPROVAL_ERRORS.COMMENT_REQUIRED);
  }

  if (!canActorApproveDecisionObject(actor, decisionObject)) {
    errors.push(APPROVAL_ERRORS.UNAUTHORIZED_APPROVER);
  }

  if (errors.length > 0) {
    return Object.freeze({
      ok: false,
      validation: freezeValidation(errors)
    });
  }

  const timestamp = now.toISOString();
  const approval = Object.freeze({
    approval_id:
      idGenerator?.("approval") ??
      `approval-${decisionObject.object_id}-${version.version_number}-${Date.now()}`,
    object_id: decisionObject.object_id,
    version_id: version.version_id,
    approver_id: actor.id,
    decision,
    comment,
    status: APPROVAL_STATUSES.ACTIVE,
    created_at: timestamp,
    invalidated_at: null,
    invalidation_reason: null
  });

  return Object.freeze({
    ok: true,
    approval,
    decisionObject: Object.freeze({
      ...decisionObject,
      status: statusForApprovalDecision(decision),
      updated_at: timestamp
    })
  });
}

export function canActorApproveDecisionObject(actor, decisionObject) {
  if (!actorHasPermission(actor, PERMISSIONS.APPROVE_DECISION) || !decisionObject) {
    return false;
  }

  const requiredRole = getRequiredApproverRole(decisionObject);

  return actor.role === requiredRole || decisionObject.owner_id === actor.id;
}

export function getRequiredApproverRole(decisionObject) {
  return REQUIRED_APPROVER_ROLES_BY_TYPE[decisionObject?.type] ?? null;
}

export function isApprovalQueueItemForActor(decisionObject, currentVersion, approvals, actor) {
  if (!canActorApproveDecisionObject(actor, decisionObject) || !currentVersion) {
    return false;
  }

  return !approvals.some(
    (approval) =>
      approval.version_id === currentVersion.version_id &&
      approval.status === APPROVAL_STATUSES.ACTIVE &&
      approval.decision === APPROVAL_DECISIONS.APPROVED
  );
}

export function buildApprovalAuditEvent(
  approval,
  decisionObject,
  actor,
  { idGenerator, now = new Date() } = {}
) {
  return Object.freeze({
    audit_event_id:
      idGenerator?.("audit") ?? `audit-${approval.approval_id}-${Date.now()}`,
    project_id: decisionObject.project_id,
    actor_id: actor.id,
    event_type:
      approval.decision === APPROVAL_DECISIONS.APPROVED
        ? AUDIT_EVENT_TYPES.APPROVE
        : AUDIT_EVENT_TYPES.REJECT,
    entity_type: "approval",
    entity_id: approval.approval_id,
    timestamp: now.toISOString(),
    details: Object.freeze({
      object_id: decisionObject.object_id,
      version_id: approval.version_id,
      approval_decision: approval.decision,
      approval_status: approval.status
    }),
    immutable_hash: null
  });
}

export function toApprovalSummary(approval, decisionObject = null, version = null) {
  return Object.freeze({
    approvalId: approval.approval_id,
    objectId: approval.object_id,
    versionId: approval.version_id,
    versionNumber: version?.version_number ?? null,
    approverId: approval.approver_id,
    approvalDecision: approval.decision,
    comment: approval.comment,
    status: approval.status,
    createdAt: approval.created_at,
    invalidatedAt: approval.invalidated_at,
    invalidationReason: approval.invalidation_reason,
    objectTitle: decisionObject?.title ?? null,
    objectType: decisionObject?.type ?? null
  });
}

export function toApprovalQueueItem(decisionObject, version, approvals = []) {
  const activeApprovals = approvals.filter(
    (approval) => approval.status === APPROVAL_STATUSES.ACTIVE
  );
  const latestApproval = activeApprovals.at(-1) ?? null;

  return Object.freeze({
    objectId: decisionObject.object_id,
    projectId: decisionObject.project_id,
    objectType: decisionObject.type,
    title: decisionObject.title,
    ownerId: decisionObject.owner_id,
    status: decisionObject.status,
    versionId: version.version_id,
    versionNumber: version.version_number,
    content: version.content,
    requiredApproverRole: getRequiredApproverRole(decisionObject),
    latestApproval: latestApproval ? toApprovalSummary(latestApproval, decisionObject, version) : null
  });
}

function statusForApprovalDecision(decision) {
  if (decision === APPROVAL_DECISIONS.APPROVED) {
    return DECISION_OBJECT_STATUSES.APPROVED;
  }

  if (decision === APPROVAL_DECISIONS.REJECTED) {
    return DECISION_OBJECT_STATUSES.REJECTED;
  }

  return DECISION_OBJECT_STATUSES.IN_REVIEW;
}

function normalizeApprovalDecision(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase().replaceAll(" ", "_");
  return Object.values(APPROVAL_DECISIONS).includes(normalized) ? normalized : null;
}

function normalizeOptionalString(value) {
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
