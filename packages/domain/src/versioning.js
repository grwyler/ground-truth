import {
  APPROVAL_STATUSES,
  AUDIT_EVENT_TYPES
} from "./models/index.js";

export const VERSIONING_ERRORS = Object.freeze({
  OBJECT_REQUIRED: "VERSIONING_OBJECT_REQUIRED",
  FROM_VERSION_REQUIRED: "VERSIONING_FROM_VERSION_REQUIRED",
  TO_VERSION_REQUIRED: "VERSIONING_TO_VERSION_REQUIRED",
  VERSION_ORDER_INVALID: "VERSIONING_VERSION_ORDER_INVALID"
});

export const VERSION_DIFF_CHANGE_TYPES = Object.freeze({
  ADDED: "added",
  REMOVED: "removed",
  MODIFIED: "modified"
});

export function buildApprovalInvalidations(
  approvals = [],
  decisionObject,
  previousVersion,
  nextVersion,
  actor,
  { now = new Date(), idGenerator } = {}
) {
  const timestamp = now.toISOString();
  const reason = `Version ${previousVersion.version_number} was superseded by version ${
    nextVersion.version_number
  } after a meaningful content change.`;
  const impactedApprovals = approvals.filter(
    (approval) =>
      approval.object_id === decisionObject.object_id &&
      approval.status === APPROVAL_STATUSES.ACTIVE &&
      approval.version_id !== nextVersion.version_id
  );

  return Object.freeze({
    invalidatedApprovals: Object.freeze(
      impactedApprovals.map((approval) =>
        Object.freeze({
          ...approval,
          status: APPROVAL_STATUSES.INVALIDATED,
          invalidated_at: timestamp,
          invalidation_reason: reason
        })
      )
    ),
    auditEvents: Object.freeze(
      impactedApprovals.map((approval) =>
        Object.freeze({
          audit_event_id:
            idGenerator?.("audit") ?? `audit-${approval.approval_id}-invalidated-${Date.now()}`,
          project_id: decisionObject.project_id,
          actor_id: actor.id,
          event_type: AUDIT_EVENT_TYPES.UPDATE,
          entity_type: "approval",
          entity_id: approval.approval_id,
          timestamp,
          details: Object.freeze({
            object_id: decisionObject.object_id,
            previous_version_id: previousVersion.version_id,
            next_version_id: nextVersion.version_id,
            approval_status: APPROVAL_STATUSES.INVALIDATED,
            invalidation_reason: reason
          }),
          immutable_hash: null
        })
      )
    )
  });
}

export function buildVersionDiff(decisionObject, fromVersion, toVersion) {
  const errors = [];

  if (!decisionObject) {
    errors.push(VERSIONING_ERRORS.OBJECT_REQUIRED);
  }

  if (!fromVersion) {
    errors.push(VERSIONING_ERRORS.FROM_VERSION_REQUIRED);
  }

  if (!toVersion) {
    errors.push(VERSIONING_ERRORS.TO_VERSION_REQUIRED);
  }

  if (
    fromVersion &&
    toVersion &&
    Number(fromVersion.version_number) >= Number(toVersion.version_number)
  ) {
    errors.push(VERSIONING_ERRORS.VERSION_ORDER_INVALID);
  }

  if (errors.length > 0) {
    return Object.freeze({
      ok: false,
      validation: Object.freeze({
        valid: false,
        errors: Object.freeze([...new Set(errors)])
      })
    });
  }

  return Object.freeze({
    ok: true,
    diff: Object.freeze({
      objectId: decisionObject.object_id,
      fromVersion: fromVersion.version_number,
      toVersion: toVersion.version_number,
      changes: Object.freeze(diffContent(fromVersion.content, toVersion.content))
    })
  });
}

function diffContent(previousContent = {}, nextContent = {}) {
  const fields = new Set([
    ...Object.keys(previousContent ?? {}),
    ...Object.keys(nextContent ?? {})
  ]);
  const changes = [];

  fields.delete("ai_review_status");

  for (const field of [...fields].sort()) {
    const before = previousContent?.[field];
    const after = nextContent?.[field];

    if (deepEqual(before, after)) {
      continue;
    }

    changes.push(
      Object.freeze({
        field: `content.${field}`,
        changeType: getChangeType(before, after),
        before: normalizeDiffValue(before),
        after: normalizeDiffValue(after)
      })
    );
  }

  return changes;
}

function getChangeType(before, after) {
  if (before === undefined) {
    return VERSION_DIFF_CHANGE_TYPES.ADDED;
  }

  if (after === undefined) {
    return VERSION_DIFF_CHANGE_TYPES.REMOVED;
  }

  return VERSION_DIFF_CHANGE_TYPES.MODIFIED;
}

function normalizeDiffValue(value) {
  if (value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return Object.freeze([...value]);
  }

  if (value && typeof value === "object") {
    return Object.freeze(structuredClone(value));
  }

  return value;
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
