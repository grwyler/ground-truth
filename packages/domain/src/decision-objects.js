import {
  AUDIT_EVENT_TYPES,
  DECISION_OBJECT_STATUSES
} from "./models/index.js";

export const DRAFT_REVIEW_STATUSES = Object.freeze({
  SUGGESTED: "suggested",
  ACCEPTED: "accepted",
  REJECTED: "rejected"
});

export const DECISION_OBJECT_ERRORS = Object.freeze({
  TITLE_REQUIRED: "DECISION_OBJECT_TITLE_REQUIRED",
  CONTENT_REQUIRED: "DECISION_OBJECT_CONTENT_REQUIRED",
  OBJECT_REQUIRED: "DECISION_OBJECT_REQUIRED",
  VERSION_REQUIRED: "DECISION_OBJECT_VERSION_REQUIRED"
});

export function buildDecisionObjectUpdate(decisionObject, version, input = {}, actor, { now = new Date() } = {}) {
  const errors = [...validateDecisionObjectDraftUpdate(input).errors];

  if (!decisionObject) {
    errors.push(DECISION_OBJECT_ERRORS.OBJECT_REQUIRED);
  }

  if (!version) {
    errors.push(DECISION_OBJECT_ERRORS.VERSION_REQUIRED);
  }

  if (errors.length > 0) {
    return Object.freeze({
      ok: false,
      validation: freezeValidation(errors)
    });
  }

  const timestamp = now.toISOString();
  const title = normalizeRequiredString(input.title);
  const content = normalizeDraftContent(input.content);

  return Object.freeze({
    ok: true,
    decisionObject: Object.freeze({
      ...decisionObject,
      title,
      updated_at: timestamp
    }),
    version: Object.freeze({
      ...version,
      content: Object.freeze({
        ...version.content,
        ...content,
        ai_review_status: version.content?.ai_review_status ?? DRAFT_REVIEW_STATUSES.SUGGESTED
      }),
      change_reason: normalizeOptionalString(input.changeReason) ?? "Draft reviewed and edited.",
      changed_by: actor.id,
      meaningful_change: true
    })
  });
}

export function acceptDecisionDraft(decisionObject, version, actor, { now = new Date() } = {}) {
  return updateDecisionDraftReviewStatus(
    decisionObject,
    version,
    actor,
    DRAFT_REVIEW_STATUSES.ACCEPTED,
    DECISION_OBJECT_STATUSES.DRAFT,
    "AI draft accepted into the active decision object set.",
    { now }
  );
}

export function rejectDecisionDraft(decisionObject, version, actor, { now = new Date() } = {}) {
  return updateDecisionDraftReviewStatus(
    decisionObject,
    version,
    actor,
    DRAFT_REVIEW_STATUSES.REJECTED,
    DECISION_OBJECT_STATUSES.REJECTED,
    "AI draft rejected and excluded from readiness computation.",
    { now }
  );
}

export function isRejectedDecisionDraft(decisionObject, version) {
  return (
    decisionObject?.status === DECISION_OBJECT_STATUSES.REJECTED ||
    version?.content?.ai_review_status === DRAFT_REVIEW_STATUSES.REJECTED
  );
}

export function buildDecisionObjectAuditEvent(
  decisionObject,
  actor,
  action,
  details = {},
  { idGenerator, now = new Date() } = {}
) {
  const eventType =
    action === DRAFT_REVIEW_STATUSES.REJECTED
      ? AUDIT_EVENT_TYPES.REJECT
      : AUDIT_EVENT_TYPES.UPDATE;

  return Object.freeze({
    audit_event_id:
      idGenerator?.() ?? `audit-${decisionObject.object_id}-${action}-${Date.now()}`,
    project_id: decisionObject.project_id,
    actor_id: actor.id,
    event_type: eventType,
    entity_type: "decision_object",
    entity_id: decisionObject.object_id,
    timestamp: now.toISOString(),
    details: Object.freeze({
      review_status: action,
      object_status: decisionObject.status,
      ...details
    }),
    immutable_hash: null
  });
}

export function validateDecisionObjectDraftUpdate(input = {}) {
  const errors = [];

  if (!normalizeRequiredString(input.title)) {
    errors.push(DECISION_OBJECT_ERRORS.TITLE_REQUIRED);
  }

  if (!isPlainObject(input.content)) {
    errors.push(DECISION_OBJECT_ERRORS.CONTENT_REQUIRED);
  }

  return freezeValidation(errors);
}

function updateDecisionDraftReviewStatus(
  decisionObject,
  version,
  actor,
  reviewStatus,
  objectStatus,
  changeReason,
  { now = new Date() } = {}
) {
  const errors = [];

  if (!decisionObject) {
    errors.push(DECISION_OBJECT_ERRORS.OBJECT_REQUIRED);
  }

  if (!version) {
    errors.push(DECISION_OBJECT_ERRORS.VERSION_REQUIRED);
  }

  if (errors.length > 0) {
    return Object.freeze({
      ok: false,
      validation: freezeValidation(errors)
    });
  }

  const timestamp = now.toISOString();

  return Object.freeze({
    ok: true,
    decisionObject: Object.freeze({
      ...decisionObject,
      status: objectStatus,
      updated_at: timestamp
    }),
    version: Object.freeze({
      ...version,
      content: Object.freeze({
        ...version.content,
        ai_review_status: reviewStatus
      }),
      change_reason: changeReason,
      changed_by: actor.id
    })
  });
}

function normalizeDraftContent(content) {
  const normalized = {};

  for (const [key, value] of Object.entries(content)) {
    if (typeof value === "string") {
      normalized[key] = value.trim();
      continue;
    }

    if (Array.isArray(value)) {
      normalized[key] = Object.freeze(
        value
          .map((item) => (typeof item === "string" ? item.trim() : item))
          .filter((item) => item !== "")
      );
      continue;
    }

    normalized[key] = value;
  }

  return Object.freeze(normalized);
}

function normalizeRequiredString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeOptionalString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function freezeValidation(errors) {
  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze([...new Set(errors)])
  });
}
