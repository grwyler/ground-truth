import {
  AI_JOB_STATUSES,
  AUDIT_EVENT_TYPES,
  DECISION_OBJECT_STATUSES,
  DECISION_OBJECT_TYPES,
  PRIORITIES
} from "./models/index.js";

export const AI_DRAFT_SCHEMA_VERSION = "mvp-draft-v1";

export const AI_GENERATION_ERRORS = Object.freeze({
  PROJECT_REQUIRED: "AI_PROJECT_REQUIRED",
  DOCUMENTS_REQUIRED: "AI_DOCUMENTS_REQUIRED",
  INVALID_OUTPUT: "AI_INVALID_OUTPUT"
});

export const AI_GENERATION_SCOPE = Object.freeze([
  "workflows",
  "requirements",
  "tests",
  "risks"
]);

export function validateAiGenerationRequest(input = {}) {
  const errors = [];

  if (!normalizeOptionalString(input.projectId ?? input.project_id)) {
    errors.push(AI_GENERATION_ERRORS.PROJECT_REQUIRED);
  }

  if (!Array.isArray(input.documents) || input.documents.length === 0) {
    errors.push(AI_GENERATION_ERRORS.DOCUMENTS_REQUIRED);
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors)
  });
}

export function buildQueuedAiGenerationJob(
  input,
  actor,
  { now = new Date(), idGenerator } = {}
) {
  const validation = validateAiGenerationRequest(input);

  if (!validation.valid) {
    return Object.freeze({
      ok: false,
      validation
    });
  }

  const documents = input.documents;
  const timestamp = now.toISOString();
  const generationJobId = idGenerator?.() ?? `ai-job-${cryptoSafeRandomId()}`;

  return Object.freeze({
    ok: true,
    job: Object.freeze({
      generation_job_id: generationJobId,
      project_id: normalizeOptionalString(input.projectId ?? input.project_id),
      document_ids: Object.freeze(documents.map((document) => document.document_id)),
      status: AI_JOB_STATUSES.QUEUED,
      generation_scope: AI_GENERATION_SCOPE,
      ai_schema_version: AI_DRAFT_SCHEMA_VERSION,
      created_by: actor.id,
      created_at: timestamp,
      completed_at: null,
      error_message: null
    })
  });
}

export function markAiGenerationJobRunning(job) {
  return Object.freeze({
    ...job,
    status: AI_JOB_STATUSES.RUNNING,
    completed_at: null,
    error_message: null
  });
}

export function markAiGenerationJobCompleted(job, { now = new Date() } = {}) {
  return Object.freeze({
    ...job,
    status: AI_JOB_STATUSES.COMPLETED,
    completed_at: now.toISOString(),
    error_message: null
  });
}

export function markAiGenerationJobFailed(job, errorMessage, { now = new Date() } = {}) {
  return Object.freeze({
    ...job,
    status: AI_JOB_STATUSES.FAILED,
    completed_at: now.toISOString(),
    error_message: normalizeOptionalString(errorMessage) ?? "AI draft generation failed."
  });
}

export function normalizeAiDraftOutput(output, job, actor, { now = new Date(), idGenerator } = {}) {
  const validation = validateAiDraftOutput(output);

  if (!validation.valid) {
    return Object.freeze({
      ok: false,
      validation
    });
  }

  const timestamp = now.toISOString();
  const decisionObjects = [];
  const decisionObjectVersions = [];

  for (const suggestion of output.suggestions) {
    const objectId = idGenerator?.() ?? `obj-ai-${cryptoSafeRandomId()}`;
    const versionId = idGenerator?.() ?? `ver-ai-${cryptoSafeRandomId()}`;
    const sourceDocumentIds =
      Array.isArray(suggestion.sourceDocumentIds) && suggestion.sourceDocumentIds.length > 0
        ? suggestion.sourceDocumentIds
        : job.document_ids;

    decisionObjects.push(
      Object.freeze({
        object_id: objectId,
        project_id: job.project_id,
        type: suggestion.type,
        title: normalizeOptionalString(suggestion.title),
        current_version: 1,
        status: DECISION_OBJECT_STATUSES.DRAFT,
        owner_id: null,
        priority: suggestion.priority ?? PRIORITIES.MEDIUM,
        created_by: actor.id,
        created_at: timestamp,
        updated_at: timestamp
      })
    );

    decisionObjectVersions.push(
      Object.freeze({
        version_id: versionId,
        object_id: objectId,
        version_number: 1,
        content: Object.freeze({
          ...suggestion.content,
          source_document_ids: Object.freeze([...sourceDocumentIds]),
          ai_generated: true,
          ai_schema_version: output.schemaVersion,
          generation_job_id: job.generation_job_id
        }),
        change_reason: "Initial AI-generated draft candidate.",
        changed_by: actor.id,
        created_at: timestamp,
        meaningful_change: true
      })
    );
  }

  return Object.freeze({
    ok: true,
    decisionObjects: Object.freeze(decisionObjects),
    decisionObjectVersions: Object.freeze(decisionObjectVersions)
  });
}

export function buildAiGenerationAuditEvent(job, actor, details = {}, { idGenerator } = {}) {
  return Object.freeze({
    audit_event_id: idGenerator?.() ?? `audit-${job.generation_job_id}-${job.status}`,
    project_id: job.project_id,
    actor_id: actor.id,
    event_type: AUDIT_EVENT_TYPES.CREATE,
    entity_type: "ai_generation_job",
    entity_id: job.generation_job_id,
    timestamp: job.completed_at ?? job.created_at,
    details: Object.freeze({
      status: job.status,
      document_ids: Object.freeze([...job.document_ids]),
      ai_schema_version: job.ai_schema_version,
      ...details
    }),
    immutable_hash: null
  });
}

export function toAiGenerationJobSummary(job) {
  return Object.freeze({
    generationJobId: job.generation_job_id,
    projectId: job.project_id,
    documentIds: Object.freeze([...job.document_ids]),
    status: job.status,
    generationScope: Object.freeze([...job.generation_scope]),
    aiSchemaVersion: job.ai_schema_version,
    createdBy: job.created_by,
    createdAt: job.created_at,
    completedAt: job.completed_at,
    errorMessage: job.error_message
  });
}

export function toDecisionObjectSummary(decisionObject, version = null) {
  return Object.freeze({
    objectId: decisionObject.object_id,
    projectId: decisionObject.project_id,
    type: decisionObject.type,
    title: decisionObject.title,
    currentVersion: decisionObject.current_version,
    status: decisionObject.status,
    ownerId: decisionObject.owner_id,
    priority: decisionObject.priority,
    createdBy: decisionObject.created_by,
    createdAt: decisionObject.created_at,
    updatedAt: decisionObject.updated_at,
    content: version?.content ?? null,
    versionId: version?.version_id ?? null
  });
}

function validateAiDraftOutput(output) {
  const errors = [];

  if (output?.schemaVersion !== AI_DRAFT_SCHEMA_VERSION) {
    errors.push(AI_GENERATION_ERRORS.INVALID_OUTPUT);
  }

  if (!Array.isArray(output?.suggestions) || output.suggestions.length === 0) {
    errors.push(AI_GENERATION_ERRORS.INVALID_OUTPUT);
  } else {
    for (const suggestion of output.suggestions) {
      if (!Object.values(DECISION_OBJECT_TYPES).includes(suggestion.type)) {
        errors.push(AI_GENERATION_ERRORS.INVALID_OUTPUT);
      }

      if (!normalizeOptionalString(suggestion.title) || !isPlainObject(suggestion.content)) {
        errors.push(AI_GENERATION_ERRORS.INVALID_OUTPUT);
      }
    }
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze([...new Set(errors)])
  });
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
