import {
  AUDIT_EVENT_TYPES,
  DECISION_OBJECT_TYPES,
  TRACE_RELATIONSHIP_TYPES
} from "./models/index.js";

export const TRACEABILITY_ERRORS = Object.freeze({
  SOURCE_REQUIRED: "TRACE_SOURCE_REQUIRED",
  TARGET_REQUIRED: "TRACE_TARGET_REQUIRED",
  TARGET_PROJECT_MISMATCH: "TRACE_TARGET_PROJECT_MISMATCH",
  SELF_LINK: "TRACE_SELF_LINK_NOT_ALLOWED",
  RELATIONSHIP_REQUIRED: "TRACE_RELATIONSHIP_REQUIRED",
  RELATIONSHIP_NOT_SUPPORTED: "TRACE_RELATIONSHIP_NOT_SUPPORTED",
  INVALID_RELATIONSHIP: "TRACE_INVALID_RELATIONSHIP"
});

export const MVP_TRACE_RELATIONSHIP_TYPES = Object.freeze([
  TRACE_RELATIONSHIP_TYPES.DERIVED_FROM,
  TRACE_RELATIONSHIP_TYPES.VALIDATED_BY,
  TRACE_RELATIONSHIP_TYPES.DEPENDS_ON,
  TRACE_RELATIONSHIP_TYPES.REFERENCES
]);

export function buildTraceLinkCreate(
  sourceObject,
  targetObject,
  input = {},
  actor,
  { idGenerator, now = new Date() } = {}
) {
  const validation = validateTraceLinkCreate(sourceObject, targetObject, input);

  if (!validation.valid) {
    return Object.freeze({
      ok: false,
      validation
    });
  }

  const relationshipType = input.relationshipType ?? input.relationship_type;

  return Object.freeze({
    ok: true,
    traceLink: Object.freeze({
      link_id: idGenerator?.("trace-link") ?? `link-${cryptoSafeRandomId()}`,
      project_id: sourceObject.project_id,
      source_object_id: sourceObject.object_id,
      target_object_id: targetObject.object_id,
      relationship_type: relationshipType,
      required_for_readiness: isMandatoryReadinessTrace(
        sourceObject,
        targetObject,
        relationshipType
      ),
      created_by: actor.id,
      created_at: now.toISOString()
    })
  });
}

export function validateTraceLinkCreate(sourceObject, targetObject, input = {}) {
  const errors = [];
  const relationshipType = input.relationshipType ?? input.relationship_type;

  if (!sourceObject) {
    errors.push(TRACEABILITY_ERRORS.SOURCE_REQUIRED);
  }

  if (!targetObject) {
    errors.push(TRACEABILITY_ERRORS.TARGET_REQUIRED);
  }

  if (!relationshipType) {
    errors.push(TRACEABILITY_ERRORS.RELATIONSHIP_REQUIRED);
  } else if (!MVP_TRACE_RELATIONSHIP_TYPES.includes(relationshipType)) {
    errors.push(TRACEABILITY_ERRORS.RELATIONSHIP_NOT_SUPPORTED);
  }

  if (sourceObject && targetObject) {
    if (sourceObject.project_id !== targetObject.project_id) {
      errors.push(TRACEABILITY_ERRORS.TARGET_PROJECT_MISMATCH);
    }

    if (sourceObject.object_id === targetObject.object_id) {
      errors.push(TRACEABILITY_ERRORS.SELF_LINK);
    }

    if (
      relationshipType &&
      MVP_TRACE_RELATIONSHIP_TYPES.includes(relationshipType) &&
      !isValidTraceRelationship(sourceObject, targetObject, relationshipType)
    ) {
      errors.push(TRACEABILITY_ERRORS.INVALID_RELATIONSHIP);
    }
  }

  return freezeValidation(errors);
}

export function isValidTraceRelationship(sourceObject, targetObject, relationshipType) {
  if (
    relationshipType === TRACE_RELATIONSHIP_TYPES.DERIVED_FROM &&
    sourceObject.type === DECISION_OBJECT_TYPES.REQUIREMENT &&
    targetObject.type === DECISION_OBJECT_TYPES.WORKFLOW
  ) {
    return true;
  }

  if (
    relationshipType === TRACE_RELATIONSHIP_TYPES.VALIDATED_BY &&
    sourceObject.type === DECISION_OBJECT_TYPES.REQUIREMENT &&
    targetObject.type === DECISION_OBJECT_TYPES.TEST
  ) {
    return true;
  }

  return [
    TRACE_RELATIONSHIP_TYPES.DEPENDS_ON,
    TRACE_RELATIONSHIP_TYPES.REFERENCES
  ].includes(relationshipType);
}

export function isMandatoryReadinessTrace(sourceObject, targetObject, relationshipType) {
  return (
    sourceObject.type === DECISION_OBJECT_TYPES.REQUIREMENT &&
    ((relationshipType === TRACE_RELATIONSHIP_TYPES.DERIVED_FROM &&
      targetObject.type === DECISION_OBJECT_TYPES.WORKFLOW) ||
      (relationshipType === TRACE_RELATIONSHIP_TYPES.VALIDATED_BY &&
        targetObject.type === DECISION_OBJECT_TYPES.TEST))
  );
}

export function buildTraceLinkAuditEvent(
  traceLink,
  actor,
  action,
  { idGenerator, now = new Date() } = {}
) {
  return Object.freeze({
    audit_event_id: idGenerator?.() ?? `audit-${traceLink.link_id}-${action}-${Date.now()}`,
    project_id: traceLink.project_id,
    actor_id: actor.id,
    event_type: action === "deleted" ? AUDIT_EVENT_TYPES.UPDATE : AUDIT_EVENT_TYPES.CREATE,
    entity_type: "trace_link",
    entity_id: traceLink.link_id,
    timestamp: now.toISOString(),
    details: Object.freeze({
      action,
      source_object_id: traceLink.source_object_id,
      target_object_id: traceLink.target_object_id,
      relationship_type: traceLink.relationship_type,
      required_for_readiness: traceLink.required_for_readiness
    }),
    immutable_hash: null
  });
}

export function toTraceLinkSummary(traceLink, sourceObject = null, targetObject = null) {
  return Object.freeze({
    linkId: traceLink.link_id,
    projectId: traceLink.project_id,
    sourceObjectId: traceLink.source_object_id,
    targetObjectId: traceLink.target_object_id,
    relationshipType: traceLink.relationship_type,
    requiredForReadiness: traceLink.required_for_readiness,
    createdBy: traceLink.created_by,
    createdAt: traceLink.created_at,
    sourceTitle: sourceObject?.title ?? null,
    sourceType: sourceObject?.type ?? null,
    targetTitle: targetObject?.title ?? null,
    targetType: targetObject?.type ?? null
  });
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
