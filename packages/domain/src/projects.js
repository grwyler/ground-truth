import {
  AUDIT_EVENT_TYPES,
  PROJECT_STATUSES,
  READINESS_STATUSES
} from "./models/index.js";

export const PROJECT_VALIDATION_ERRORS = Object.freeze({
  NAME_REQUIRED: "PROJECT_NAME_REQUIRED"
});

export function validateProjectIntake(input = {}) {
  const errors = [];
  const name = normalizeOptionalString(input.name);

  if (!name) {
    errors.push(PROJECT_VALIDATION_ERRORS.NAME_REQUIRED);
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors)
  });
}

export function buildProjectRecord(input, actor, { now = new Date(), idGenerator } = {}) {
  const validation = validateProjectIntake(input);

  if (!validation.valid) {
    return Object.freeze({
      ok: false,
      validation
    });
  }

  const timestamp = now.toISOString();
  const projectId = idGenerator?.() ?? `project-${cryptoSafeRandomId()}`;

  return Object.freeze({
    ok: true,
    project: Object.freeze({
      project_id: projectId,
      name: normalizeOptionalString(input.name),
      description: normalizeOptionalString(input.description),
      customer: normalizeOptionalString(input.customer),
      contract_number: normalizeOptionalString(input.contractNumber ?? input.contract_number),
      program_name: normalizeOptionalString(input.programName ?? input.program_name),
      status: PROJECT_STATUSES.DRAFT,
      readiness_status: READINESS_STATUSES.NOT_READY,
      readiness_score: 0,
      created_by: actor.id,
      created_at: timestamp,
      updated_at: timestamp
    })
  });
}

export function buildProjectCreatedAuditEvent(project, actor, { idGenerator } = {}) {
  return Object.freeze({
    audit_event_id: idGenerator?.() ?? `audit-${project.project_id}-create`,
    project_id: project.project_id,
    actor_id: actor.id,
    event_type: AUDIT_EVENT_TYPES.CREATE,
    entity_type: "project",
    entity_id: project.project_id,
    timestamp: project.created_at,
    details: Object.freeze({
      name: project.name,
      readiness_status: project.readiness_status
    }),
    immutable_hash: null
  });
}

export function toProjectSummary(project) {
  return Object.freeze({
    projectId: project.project_id,
    name: project.name,
    description: project.description,
    customer: project.customer,
    contractNumber: project.contract_number,
    programName: project.program_name,
    status: project.status,
    readinessStatus: project.readiness_status,
    readinessScore: project.readiness_score ?? 0,
    createdBy: project.created_by,
    createdAt: project.created_at,
    updatedAt: project.updated_at
  });
}

function normalizeOptionalString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function cryptoSafeRandomId() {
  return Math.random().toString(36).slice(2, 10);
}
