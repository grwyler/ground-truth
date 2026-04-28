import { AUDIT_EVENT_TYPES } from "./models/index.js";

export const AUDIT_ERRORS = Object.freeze({
  EVENT_REQUIRED: "AUDIT_EVENT_REQUIRED",
  EVENT_ID_REQUIRED: "AUDIT_EVENT_ID_REQUIRED",
  EVENT_TYPE_REQUIRED: "AUDIT_EVENT_TYPE_REQUIRED",
  EVENT_TYPE_INVALID: "AUDIT_EVENT_TYPE_INVALID",
  ENTITY_TYPE_REQUIRED: "AUDIT_ENTITY_TYPE_REQUIRED",
  TIMESTAMP_REQUIRED: "AUDIT_TIMESTAMP_REQUIRED",
  DETAILS_REQUIRED: "AUDIT_DETAILS_REQUIRED"
});

export const SENSITIVE_AUDIT_EVENT_TYPES = Object.freeze([
  AUDIT_EVENT_TYPES.APPROVE,
  AUDIT_EVENT_TYPES.REJECT,
  AUDIT_EVENT_TYPES.OVERRIDE,
  AUDIT_EVENT_TYPES.EXPORT
]);

export function validateAuditEvent(event) {
  const errors = [];

  if (!event || typeof event !== "object") {
    errors.push(AUDIT_ERRORS.EVENT_REQUIRED);
  }

  if (!event?.audit_event_id) {
    errors.push(AUDIT_ERRORS.EVENT_ID_REQUIRED);
  }

  if (!event?.event_type) {
    errors.push(AUDIT_ERRORS.EVENT_TYPE_REQUIRED);
  } else if (!Object.values(AUDIT_EVENT_TYPES).includes(event.event_type)) {
    errors.push(AUDIT_ERRORS.EVENT_TYPE_INVALID);
  }

  if (!event?.entity_type) {
    errors.push(AUDIT_ERRORS.ENTITY_TYPE_REQUIRED);
  }

  if (!event?.timestamp) {
    errors.push(AUDIT_ERRORS.TIMESTAMP_REQUIRED);
  }

  if (event?.details === undefined || event?.details === null) {
    errors.push(AUDIT_ERRORS.DETAILS_REQUIRED);
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze([...new Set(errors)])
  });
}

export function requireAuditEvent(event) {
  const validation = validateAuditEvent(event);

  if (!validation.valid) {
    throw new Error(`AUDIT_EVENT_INVALID:${validation.errors.join(",")}`);
  }

  return event;
}

export function isSensitiveAuditEvent(event) {
  return SENSITIVE_AUDIT_EVENT_TYPES.includes(event?.event_type);
}

export function toAuditEventSummary(event) {
  return Object.freeze({
    auditEventId: event.audit_event_id,
    projectId: event.project_id ?? null,
    actorId: event.actor_id ?? null,
    eventType: event.event_type,
    entityType: event.entity_type,
    entityId: event.entity_id ?? null,
    timestamp: event.timestamp,
    details: Object.freeze(structuredClone(event.details ?? {})),
    immutableHash: event.immutable_hash ?? null
  });
}
