import {
  AUDIT_EVENT_TYPES,
  DECISION_OBJECT_TYPES,
  DECISION_OBJECT_STATUSES
} from "./models/index.js";

export const DRAFT_REVIEW_STATUSES = Object.freeze({
  SUGGESTED: "suggested",
  ACCEPTED: "accepted",
  REJECTED: "rejected"
});

export const DECISION_OBJECT_ERRORS = Object.freeze({
  TYPE_REQUIRED: "DECISION_OBJECT_TYPE_REQUIRED",
  INVALID_TYPE: "DECISION_OBJECT_INVALID_TYPE",
  TITLE_REQUIRED: "DECISION_OBJECT_TITLE_REQUIRED",
  CONTENT_REQUIRED: "DECISION_OBJECT_CONTENT_REQUIRED",
  OBJECT_REQUIRED: "DECISION_OBJECT_REQUIRED",
  VERSION_REQUIRED: "DECISION_OBJECT_VERSION_REQUIRED",
  CHANGE_REASON_REQUIRED: "DECISION_OBJECT_CHANGE_REASON_REQUIRED"
});

export function buildDecisionObjectCreate(
  input = {},
  actor,
  { now = new Date(), idGenerator } = {}
) {
  const validation = validateDecisionObjectCreate(input);

  if (!validation.valid) {
    return Object.freeze({
      ok: false,
      validation
    });
  }

  const timestamp = now.toISOString();
  const objectId = idGenerator?.("object") ?? `obj-${cryptoSafeRandomId()}`;
  const versionId = idGenerator?.("version") ?? `ver-${cryptoSafeRandomId()}`;
  const content = normalizeDraftContent(input.content);

  return Object.freeze({
    ok: true,
    decisionObject: Object.freeze({
      object_id: objectId,
      project_id: normalizeRequiredString(input.projectId ?? input.project_id),
      type: input.type,
      title: normalizeRequiredString(input.title),
      current_version: 1,
      status: normalizeDecisionObjectStatus(input.status) ?? DECISION_OBJECT_STATUSES.DRAFT,
      owner_id: normalizeOptionalString(input.ownerId ?? input.owner_id),
      priority: normalizeOptionalString(input.priority),
      created_by: actor.id,
      created_at: timestamp,
      updated_at: timestamp
    }),
    version: Object.freeze({
      version_id: versionId,
      object_id: objectId,
      version_number: 1,
      content,
      change_reason: normalizeOptionalString(input.changeReason) ?? "Initial decision object version.",
      changed_by: actor.id,
      created_at: timestamp,
      meaningful_change: true
    })
  });
}

export function buildDecisionObjectUpdate(
  decisionObject,
  version,
  input = {},
  actor,
  { now = new Date(), idGenerator, hasExistingApprovals = false } = {}
) {
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
  const nextTitle = normalizeRequiredString(input.title) ?? decisionObject.title;
  const nextOwnerId =
    input.ownerId !== undefined || input.owner_id !== undefined
      ? normalizeOptionalString(input.ownerId ?? input.owner_id)
      : decisionObject.owner_id;
  const nextPriority =
    input.priority !== undefined
      ? normalizeOptionalString(input.priority)
      : decisionObject.priority;
  const nextStatus =
    input.status !== undefined
      ? normalizeDecisionObjectStatus(input.status) ?? decisionObject.status
      : decisionObject.status;
  const nextContent =
    input.content !== undefined
      ? Object.freeze({
          ...version.content,
          ...normalizeDraftContent(input.content)
        })
      : version.content;
  const meaningfulChange = isMeaningfulDecisionObjectChange(version.content, nextContent);
  const changeReason = normalizeOptionalString(input.changeReason);

  if (meaningfulChange && hasExistingApprovals && !changeReason) {
    return Object.freeze({
      ok: false,
      validation: freezeValidation([DECISION_OBJECT_ERRORS.CHANGE_REASON_REQUIRED])
    });
  }

  const nextVersionNumber = meaningfulChange
    ? decisionObject.current_version + 1
    : decisionObject.current_version;
  const updatedDecisionObject = Object.freeze({
    ...decisionObject,
    title: nextTitle,
    current_version: nextVersionNumber,
    status:
      meaningfulChange && decisionObject.status === DECISION_OBJECT_STATUSES.APPROVED
        ? DECISION_OBJECT_STATUSES.DRAFT
        : nextStatus,
    owner_id: nextOwnerId,
    priority: nextPriority,
    updated_at: timestamp
  });

  if (!meaningfulChange) {
    return Object.freeze({
      ok: true,
      meaningfulChange,
      decisionObject: updatedDecisionObject,
      version
    });
  }

  return Object.freeze({
    ok: true,
    meaningfulChange,
    decisionObject: updatedDecisionObject,
    version: Object.freeze({
      version_id: idGenerator?.("version") ?? `ver-${cryptoSafeRandomId()}`,
      object_id: decisionObject.object_id,
      version_number: nextVersionNumber,
      content: Object.freeze({
        ...nextContent,
        ai_review_status:
          nextContent?.ai_review_status ??
          version.content?.ai_review_status ??
          DRAFT_REVIEW_STATUSES.SUGGESTED
      }),
      change_reason: changeReason ?? "Decision object content updated.",
      changed_by: actor.id,
      created_at: timestamp,
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
  const eventType = getDecisionObjectAuditEventType(action);

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

function getDecisionObjectAuditEventType(action) {
  if (action === "created") {
    return AUDIT_EVENT_TYPES.CREATE;
  }

  if (action === DRAFT_REVIEW_STATUSES.REJECTED) {
    return AUDIT_EVENT_TYPES.REJECT;
  }

  return AUDIT_EVENT_TYPES.UPDATE;
}

export function validateDecisionObjectDraftUpdate(input = {}) {
  const errors = [];

  if (input.title !== undefined && !normalizeRequiredString(input.title)) {
    errors.push(DECISION_OBJECT_ERRORS.TITLE_REQUIRED);
  }

  if (input.content !== undefined && !isPlainObject(input.content)) {
    errors.push(DECISION_OBJECT_ERRORS.CONTENT_REQUIRED);
  }

  return freezeValidation(errors);
}

export function validateDecisionObjectCreate(input = {}) {
  const errors = [];

  if (!Object.values(DECISION_OBJECT_TYPES).includes(input.type)) {
    errors.push(
      input.type ? DECISION_OBJECT_ERRORS.INVALID_TYPE : DECISION_OBJECT_ERRORS.TYPE_REQUIRED
    );
  }

  if (!normalizeRequiredString(input.projectId ?? input.project_id)) {
    errors.push(DECISION_OBJECT_ERRORS.OBJECT_REQUIRED);
  }

  if (!normalizeRequiredString(input.title)) {
    errors.push(DECISION_OBJECT_ERRORS.TITLE_REQUIRED);
  }

  if (!isPlainObject(input.content)) {
    errors.push(DECISION_OBJECT_ERRORS.CONTENT_REQUIRED);
  }

  return freezeValidation(errors);
}

export function isMeaningfulDecisionObjectChange(previousContent = {}, nextContent = {}) {
  return !deepEqual(normalizeComparableContent(previousContent), normalizeComparableContent(nextContent));
}

export function toDecisionObjectVersionSummary(version) {
  return Object.freeze({
    versionId: version.version_id,
    objectId: version.object_id,
    versionNumber: version.version_number,
    content: version.content,
    changeReason: version.change_reason,
    changedBy: version.changed_by,
    createdAt: version.created_at,
    meaningfulChange: version.meaningful_change
  });
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

function normalizeComparableContent(content = {}) {
  const normalized = {};

  for (const [key, value] of Object.entries(content ?? {})) {
    if (key === "ai_review_status") {
      continue;
    }

    normalized[key] = value;
  }

  return normalized;
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
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

function normalizeDecisionObjectStatus(value) {
  return Object.values(DECISION_OBJECT_STATUSES).includes(value) ? value : null;
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

function cryptoSafeRandomId() {
  return Math.random().toString(36).slice(2, 10);
}
