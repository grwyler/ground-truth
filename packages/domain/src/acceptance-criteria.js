import {
  DECISION_OBJECT_TYPES,
  TRACE_RELATIONSHIP_TYPES
} from "./models/index.js";
import { buildDecisionObjectCreate } from "./decision-objects.js";
import { buildTraceLinkCreate } from "./traceability.js";

export const ACCEPTANCE_CRITERIA_ERRORS = Object.freeze({
  REQUIREMENT_REQUIRED: "ACCEPTANCE_REQUIREMENT_REQUIRED",
  INVALID_REQUIREMENT_TYPE: "ACCEPTANCE_REQUIREMENT_INVALID_TYPE",
  CRITERIA_REQUIRED: "ACCEPTANCE_CRITERIA_REQUIRED"
});

export function buildAcceptanceCriteriaCreate(
  requirement,
  input = {},
  actor,
  { idGenerator, now = new Date() } = {}
) {
  const baseValidation = validateAcceptanceCriteriaCreate(requirement, input);

  if (!baseValidation.valid) {
    return Object.freeze({
      ok: false,
      validation: baseValidation
    });
  }

  const criteria = normalizeCriteria(input.criteria ?? input.acceptanceCriteria);
  const title =
    normalizeOptionalString(input.title) ??
    `Acceptance criteria for ${requirement.title}`;
  const testCreate = buildDecisionObjectCreate(
    {
      projectId: requirement.project_id,
      type: DECISION_OBJECT_TYPES.TEST,
      title,
      content: {
        acceptance_criteria: criteria
      },
      ownerId: normalizeOptionalString(input.ownerId ?? input.owner_id) ?? requirement.owner_id,
      priority: normalizeOptionalString(input.priority) ?? requirement.priority
    },
    actor,
    { idGenerator, now }
  );

  if (!testCreate.ok) {
    return Object.freeze({
      ok: false,
      validation: testCreate.validation
    });
  }

  const traceLinkCreate = buildTraceLinkCreate(
    requirement,
    testCreate.decisionObject,
    { relationshipType: TRACE_RELATIONSHIP_TYPES.VALIDATED_BY },
    actor,
    { idGenerator, now }
  );

  if (!traceLinkCreate.ok) {
    return Object.freeze({
      ok: false,
      validation: traceLinkCreate.validation
    });
  }

  return Object.freeze({
    ok: true,
    decisionObject: testCreate.decisionObject,
    version: testCreate.version,
    traceLink: traceLinkCreate.traceLink
  });
}

export function validateAcceptanceCriteriaCreate(requirement, input = {}) {
  const errors = [];

  if (!requirement) {
    errors.push(ACCEPTANCE_CRITERIA_ERRORS.REQUIREMENT_REQUIRED);
  } else if (requirement.type !== DECISION_OBJECT_TYPES.REQUIREMENT) {
    errors.push(ACCEPTANCE_CRITERIA_ERRORS.INVALID_REQUIREMENT_TYPE);
  }

  if (normalizeCriteria(input.criteria ?? input.acceptanceCriteria).length === 0) {
    errors.push(ACCEPTANCE_CRITERIA_ERRORS.CRITERIA_REQUIRED);
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze([...new Set(errors)])
  });
}

export function toAcceptanceCriteriaSummary(decisionObject, version, traceLink = null) {
  return Object.freeze({
    objectId: decisionObject.object_id,
    projectId: decisionObject.project_id,
    title: decisionObject.title,
    currentVersion: decisionObject.current_version,
    status: decisionObject.status,
    ownerId: decisionObject.owner_id,
    criteria: Object.freeze([...(version?.content?.acceptance_criteria ?? [])]),
    versionId: version?.version_id ?? null,
    linkId: traceLink?.link_id ?? null,
    requiredForReadiness: traceLink?.required_for_readiness ?? false
  });
}

function normalizeCriteria(value) {
  const values = Array.isArray(value) ? value : String(value ?? "").split("\n");

  return Object.freeze(
    values
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
  );
}

function normalizeOptionalString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}
