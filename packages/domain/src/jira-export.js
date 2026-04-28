import { canExportToJira } from "./auth.js";
import {
  APPROVAL_DECISIONS,
  APPROVAL_STATUSES,
  AUDIT_EVENT_TYPES,
  DECISION_OBJECT_TYPES,
  JIRA_EXPORT_STATUSES,
  READINESS_STATUSES,
  TRACE_RELATIONSHIP_TYPES
} from "./models/index.js";

export const JIRA_EXPORT_MAPPING_VERSION = "mvp-jira-export-v1";
export const JIRA_EXPORT_MODES = Object.freeze({
  CREATE_EPICS_AND_STORIES: "CreateEpicsAndStories"
});

export function buildJiraExportPreview(
  project,
  readinessResult,
  {
    decisionObjects = [],
    decisionObjectVersions = [],
    traceLinks = [],
    approvals = []
  } = {},
  input = {},
  actor
) {
  const validation = validateJiraExportRequest(project, readinessResult, input, actor);

  if (!validation.valid) {
    return Object.freeze({
      ok: false,
      validation
    });
  }

  const includeTraceabilityLinks = input.includeTraceabilityLinks !== false;
  const activeDecisionObjects = decisionObjects.filter(
    (decisionObject) => decisionObject.status !== "rejected"
  );
  const decisionObjectById = new Map(
    activeDecisionObjects.map((decisionObject) => [decisionObject.object_id, decisionObject])
  );
  const currentVersionByObjectId = new Map();

  for (const decisionObject of activeDecisionObjects) {
    const version = decisionObjectVersions.find(
      (candidate) =>
        candidate.object_id === decisionObject.object_id &&
        candidate.version_number === decisionObject.current_version
    );

    if (version) {
      currentVersionByObjectId.set(decisionObject.object_id, version);
    }
  }

  const issues = activeDecisionObjects
    .filter((decisionObject) => decisionObject.type === DECISION_OBJECT_TYPES.REQUIREMENT)
    .map((requirement, index) => {
      const version = currentVersionByObjectId.get(requirement.object_id);
      const requirementLinks = traceLinks.filter(
        (traceLink) => traceLink.source_object_id === requirement.object_id
      );
      const workflowLink = findTraceTarget(
        requirementLinks,
        decisionObjectById,
        TRACE_RELATIONSHIP_TYPES.DERIVED_FROM,
        DECISION_OBJECT_TYPES.WORKFLOW
      );
      const acceptanceCriteriaLink = findTraceTarget(
        requirementLinks,
        decisionObjectById,
        TRACE_RELATIONSHIP_TYPES.VALIDATED_BY,
        DECISION_OBJECT_TYPES.TEST
      );
      const approvalMetadata = approvals
        .filter(
          (approval) =>
            approval.object_id === requirement.object_id &&
            approval.version_id === version?.version_id &&
            approval.status === APPROVAL_STATUSES.ACTIVE &&
            approval.decision === APPROVAL_DECISIONS.APPROVED
        )
        .map((approval) =>
          Object.freeze({
            approvalId: approval.approval_id,
            approverId: approval.approver_id,
            decision: approval.decision,
            versionId: approval.version_id,
            createdAt: approval.created_at
          })
        );

      return Object.freeze({
        objectId: requirement.object_id,
        issueType: "Story",
        title: requirement.title,
        summary: requirement.title,
        description: buildJiraIssueDescription(requirement, version),
        sourceRequirementId: requirement.object_id,
        versionId: version?.version_id ?? null,
        approvalMetadata: Object.freeze(approvalMetadata),
        workflowLink,
        acceptanceCriteriaLink,
        traceabilityMetadata: Object.freeze({
          projectId: project.project_id,
          jiraMappingVersion: JIRA_EXPORT_MAPPING_VERSION,
          includeTraceabilityLinks,
          requiredLinkIds: Object.freeze(
            includeTraceabilityLinks
              ? requirementLinks
                  .filter((traceLink) => traceLink.required_for_readiness)
                  .map((traceLink) => traceLink.link_id)
              : []
          )
        }),
        order: index + 1
      });
    });

  return Object.freeze({
    ok: true,
    preview: Object.freeze({
      jiraProjectKey: normalizeJiraProjectKey(input.jiraProjectKey),
      exportMode: input.exportMode ?? JIRA_EXPORT_MODES.CREATE_EPICS_AND_STORIES,
      jiraMappingVersion: JIRA_EXPORT_MAPPING_VERSION,
      issues: Object.freeze(issues)
    })
  });
}

export function buildJiraExportJob(
  project,
  preview,
  adapterResult,
  input,
  actor,
  { idGenerator, now = new Date() } = {}
) {
  const exportJobId =
    idGenerator?.("jira-export") ?? `jira-export-${project.project_id}-${Date.now()}`;
  const createdAt = now.toISOString();
  const status = adapterResult.status ?? JIRA_EXPORT_STATUSES.COMPLETED;

  return Object.freeze({
    export_job_id: exportJobId,
    project_id: project.project_id,
    jira_project_key: preview?.jiraProjectKey ?? normalizeJiraProjectKey(input.jiraProjectKey),
    status,
    created_by: actor.id,
    created_at: createdAt,
    completed_at:
      status === JIRA_EXPORT_STATUSES.QUEUED || status === JIRA_EXPORT_STATUSES.RUNNING
        ? null
        : createdAt,
    jira_issue_mappings: Object.freeze({
      jiraMappingVersion: preview?.jiraMappingVersion ?? JIRA_EXPORT_MAPPING_VERSION,
      exportMode: preview?.exportMode ?? input.exportMode ?? JIRA_EXPORT_MODES.CREATE_EPICS_AND_STORIES,
      preview: Object.freeze(preview?.issues ?? []),
      createdIssues: Object.freeze(adapterResult.createdIssues ?? []),
      errors: Object.freeze(adapterResult.errors ?? [])
    }),
    error_summary: adapterResult.errorSummary ?? null
  });
}

export function buildBlockedJiraExportJob(
  project,
  input,
  actor,
  blockers = [],
  { idGenerator, now = new Date() } = {}
) {
  const preview = Object.freeze({
    jiraProjectKey: normalizeJiraProjectKey(input.jiraProjectKey ?? "BLOCKED"),
    exportMode: input.exportMode ?? JIRA_EXPORT_MODES.CREATE_EPICS_AND_STORIES,
    jiraMappingVersion: JIRA_EXPORT_MAPPING_VERSION,
    issues: Object.freeze([])
  });
  const adapterResult = Object.freeze({
    status: JIRA_EXPORT_STATUSES.FAILED,
    createdIssues: Object.freeze([]),
    errors: Object.freeze([
      Object.freeze({
        code: "PROJECT_NOT_READY",
        message: "Jira export is blocked until Ready-to-Build status is achieved.",
        blockers: Object.freeze(
          blockers.map((blocker) =>
            Object.freeze({
              blockerId: blocker.blocker_id,
              objectId: blocker.object_id,
              description: blocker.description
            })
          )
        )
      })
    ]),
    errorSummary: "PROJECT_NOT_READY"
  });

  return buildJiraExportJob(project, preview, adapterResult, input, actor, {
    idGenerator,
    now
  });
}

export function buildJiraExportAuditEvent(job, actor, { idGenerator, now = new Date() } = {}) {
  return Object.freeze({
    audit_event_id: idGenerator?.("audit") ?? `audit-${job.export_job_id}-${Date.now()}`,
    project_id: job.project_id,
    actor_id: actor.id,
    event_type: AUDIT_EVENT_TYPES.EXPORT,
    entity_type: "jira_export",
    entity_id: job.export_job_id,
    timestamp: now.toISOString(),
    details: Object.freeze({
      jira_project_key: job.jira_project_key,
      status: job.status,
      jira_mapping_version:
        job.jira_issue_mappings?.jiraMappingVersion ?? JIRA_EXPORT_MAPPING_VERSION,
      created_issue_count: job.jira_issue_mappings?.createdIssues?.length ?? 0,
      error_summary: job.error_summary
    }),
    immutable_hash: null
  });
}

export function toJiraExportJobSummary(job) {
  const mappings = job.jira_issue_mappings ?? {};

  return Object.freeze({
    exportJobId: job.export_job_id,
    projectId: job.project_id,
    jiraProjectKey: job.jira_project_key,
    status: job.status,
    createdBy: job.created_by,
    createdAt: job.created_at,
    completedAt: job.completed_at,
    jiraMappingVersion: mappings.jiraMappingVersion ?? JIRA_EXPORT_MAPPING_VERSION,
    exportMode: mappings.exportMode ?? JIRA_EXPORT_MODES.CREATE_EPICS_AND_STORIES,
    preview: Object.freeze(mappings.preview ?? []),
    createdIssues: Object.freeze(mappings.createdIssues ?? []),
    errors: Object.freeze(mappings.errors ?? []),
    errorSummary: job.error_summary
  });
}

function validateJiraExportRequest(project, readinessResult, input, actor) {
  const errors = [];

  if (!project?.project_id) {
    errors.push("JIRA_EXPORT_PROJECT_REQUIRED");
  }

  if (!canExportToJira(actor)) {
    errors.push("JIRA_EXPORT_UNAUTHORIZED");
  }

  if (readinessResult?.evaluation?.status !== READINESS_STATUSES.READY) {
    errors.push("PROJECT_NOT_READY");
  }

  if (!normalizeJiraProjectKey(input.jiraProjectKey)) {
    errors.push("JIRA_PROJECT_KEY_REQUIRED");
  } else if (!/^[A-Z][A-Z0-9]{1,9}$/.test(normalizeJiraProjectKey(input.jiraProjectKey))) {
    errors.push("JIRA_PROJECT_KEY_INVALID");
  }

  if (
    input.exportMode &&
    input.exportMode !== JIRA_EXPORT_MODES.CREATE_EPICS_AND_STORIES
  ) {
    errors.push("JIRA_EXPORT_MODE_UNSUPPORTED");
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze([...new Set(errors)])
  });
}

function findTraceTarget(links, decisionObjectById, relationshipType, targetType) {
  const link = links.find((candidate) => {
    const target = decisionObjectById.get(candidate.target_object_id);

    return candidate.relationship_type === relationshipType && target?.type === targetType;
  });

  if (!link) {
    return null;
  }

  const target = decisionObjectById.get(link.target_object_id);

  return Object.freeze({
    linkId: link.link_id,
    objectId: target.object_id,
    title: target.title,
    relationshipType: link.relationship_type
  });
}

function buildJiraIssueDescription(requirement, version) {
  const content = version?.content ?? {};
  const requirementText = content.requirement ?? content.summary ?? requirement.title;
  const criteria = Array.isArray(content.acceptance_criteria)
    ? content.acceptance_criteria
    : [];

  if (criteria.length === 0) {
    return requirementText;
  }

  return `${requirementText}\n\nAcceptance criteria:\n${criteria
    .map((criterion) => `- ${criterion}`)
    .join("\n")}`;
}

function normalizeJiraProjectKey(value) {
  return String(value ?? "").trim().toUpperCase();
}
