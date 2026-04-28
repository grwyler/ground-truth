import {
  APPROVAL_DECISIONS,
  APPROVAL_STATUSES,
  AUDIT_EVENT_TYPES,
  BLOCKER_SEVERITIES,
  BLOCKER_STATUSES,
  BLOCKER_TYPES,
  DECISION_OBJECT_TYPES,
  READINESS_STATUSES,
  TRACE_RELATIONSHIP_TYPES
} from "./models/index.js";
import { toOverrideSummary } from "./overrides.js";

export const READINESS_RULE_SET_VERSION = "mvp-readiness-v1";

export function evaluateProjectReadiness(
  project,
  {
    decisionObjects = [],
    decisionObjectVersions = [],
    traceLinks = [],
    approvals = [],
    overrides = []
  } = {},
  { idGenerator, now = new Date() } = {}
) {
  const evaluatedAt = now.toISOString();
  const generatedBlockers = buildReadinessBlockers({
    project,
    decisionObjects,
    decisionObjectVersions,
    traceLinks,
    approvals,
    overrides,
    evaluatedAt
  });
  const unresolvedHardBlockers = generatedBlockers.filter(
    (blocker) => blocker.status === BLOCKER_STATUSES.OPEN
  );
  const readinessScore = calculateReadinessScore(generatedBlockers);
  const status =
    unresolvedHardBlockers.length > 0
      ? READINESS_STATUSES.NOT_READY
      : READINESS_STATUSES.READY;

  return Object.freeze({
    evaluation: Object.freeze({
      evaluation_id: idGenerator?.("readiness-evaluation") ?? `readiness-${project.project_id}-${Date.now()}`,
      project_id: project.project_id,
      status,
      readiness_score: readinessScore,
      rule_set_version: READINESS_RULE_SET_VERSION,
      evaluated_at: evaluatedAt,
      evaluated_by: "system-readiness-engine",
      summary: buildReadinessSummary(status, unresolvedHardBlockers.length)
    }),
    blockers: Object.freeze(generatedBlockers),
    warnings: Object.freeze([]),
    overrides: Object.freeze(overrides.map(toOverrideSummary))
  });
}

export function buildReadinessAuditEvent(evaluation, actor, { idGenerator, now = new Date() } = {}) {
  return Object.freeze({
    audit_event_id:
      idGenerator?.("audit") ?? `audit-${evaluation.evaluation_id}-${Date.now()}`,
    project_id: evaluation.project_id,
    actor_id: actor?.id ?? evaluation.evaluated_by,
    event_type: AUDIT_EVENT_TYPES.UPDATE,
    entity_type: "readiness_evaluation",
    entity_id: evaluation.evaluation_id,
    timestamp: now.toISOString(),
    details: Object.freeze({
      readiness_status: evaluation.status,
      readiness_score: evaluation.readiness_score,
      rule_set_version: evaluation.rule_set_version
    }),
    immutable_hash: null
  });
}

export function toReadinessResponse(readinessResult, project = null) {
  const hardBlockers = readinessResult.blockers
    .filter((blocker) => blocker.status === BLOCKER_STATUSES.OPEN)
    .map(toBlockerSummary);
  const resolvedBlockers = readinessResult.blockers
    .filter((blocker) => blocker.status !== BLOCKER_STATUSES.OPEN)
    .map(toBlockerSummary);

  return Object.freeze({
    projectId: readinessResult.evaluation.project_id,
    projectName: project?.name ?? null,
    status: readinessResult.evaluation.status,
    readinessScore: readinessResult.evaluation.readiness_score,
    ruleSetVersion: readinessResult.evaluation.rule_set_version,
    evaluatedAt: readinessResult.evaluation.evaluated_at,
    summary: readinessResult.evaluation.summary,
    hardBlockers: Object.freeze(hardBlockers),
    resolvedBlockers: Object.freeze(resolvedBlockers),
    warnings: readinessResult.warnings,
    overrides: readinessResult.overrides
  });
}

export function toBlockerSummary(blocker) {
  return Object.freeze({
    blockerId: blocker.blocker_id,
    projectId: blocker.project_id,
    objectId: blocker.object_id,
    objectTitle: blocker.object_title ?? null,
    ownerId: blocker.owner_id ?? null,
    type: blocker.type,
    severity: blocker.severity,
    status: blocker.status,
    description: blocker.description,
    createdAt: blocker.created_at,
    resolvedAt: blocker.resolved_at
  });
}

function buildReadinessBlockers({
  project,
  decisionObjects,
  decisionObjectVersions,
  traceLinks,
  approvals,
  overrides,
  evaluatedAt
}) {
  const overrideBlockerIds = new Set(
    overrides.flatMap((override) => override.blocker_ids ?? [])
  );
  const blockers = [];
  const activeObjects = decisionObjects.filter(
    (decisionObject) => decisionObject.status !== "rejected"
  );
  const requirements = activeObjects.filter(
    (decisionObject) => decisionObject.type === DECISION_OBJECT_TYPES.REQUIREMENT
  );
  const approvalRequiredObjects = activeObjects.filter((decisionObject) =>
    [DECISION_OBJECT_TYPES.REQUIREMENT, DECISION_OBJECT_TYPES.WORKFLOW].includes(
      decisionObject.type
    )
  );

  for (const requirement of requirements) {
    if (!hasRequiredTraceLink(requirement, traceLinks, activeObjects, DECISION_OBJECT_TYPES.WORKFLOW)) {
      blockers.push(
        createRuleBlocker({
          projectId: project.project_id,
          decisionObject: requirement,
          type: BLOCKER_TYPES.MISSING_TRACEABILITY,
          ruleId: "missing-workflow-link",
          severity: BLOCKER_SEVERITIES.CRITICAL,
          description: `${requirement.title} is missing a required workflow trace link.`,
          evaluatedAt,
          overrideBlockerIds
        })
      );
    }

    if (
      !hasAcceptanceCriteriaOrTestLink(
        requirement,
        decisionObjectVersions,
        traceLinks,
        activeObjects
      )
    ) {
      blockers.push(
        createRuleBlocker({
          projectId: project.project_id,
          decisionObject: requirement,
          type: BLOCKER_TYPES.MISSING_TRACEABILITY,
          ruleId: "missing-acceptance-criteria",
          severity: BLOCKER_SEVERITIES.CRITICAL,
          description: `${requirement.title} is missing acceptance criteria or a required test trace link.`,
          evaluatedAt,
          overrideBlockerIds
        })
      );
    }
  }

  for (const decisionObject of approvalRequiredObjects) {
    const currentVersion = decisionObjectVersions.find(
      (version) =>
        version.object_id === decisionObject.object_id &&
        version.version_number === decisionObject.current_version
    );

    if (!hasActiveApprovedCurrentVersion(decisionObject, currentVersion, approvals)) {
      blockers.push(
        createRuleBlocker({
          projectId: project.project_id,
          decisionObject,
          type: BLOCKER_TYPES.MISSING_APPROVAL,
          ruleId: "missing-required-approval",
          severity: BLOCKER_SEVERITIES.HIGH,
          description: `${decisionObject.title} is missing an active approval for the current version.`,
          evaluatedAt,
          overrideBlockerIds
        })
      );
    }
  }

  return blockers.map(Object.freeze);
}

function createRuleBlocker({
  projectId,
  decisionObject,
  type,
  ruleId,
  severity,
  description,
  evaluatedAt,
  overrideBlockerIds
}) {
  const blockerId = buildStableBlockerId(projectId, decisionObject.object_id, ruleId);

  return {
    blocker_id: blockerId,
    project_id: projectId,
    object_id: decisionObject.object_id,
    object_title: decisionObject.title,
    owner_id: decisionObject.owner_id,
    type,
    severity,
    description,
    status: overrideBlockerIds.has(blockerId)
      ? BLOCKER_STATUSES.OVERRIDDEN
      : BLOCKER_STATUSES.OPEN,
    created_at: evaluatedAt,
    resolved_at: null
  };
}

function hasRequiredTraceLink(requirement, traceLinks, decisionObjects, targetType) {
  const relationshipType =
    targetType === DECISION_OBJECT_TYPES.WORKFLOW
      ? TRACE_RELATIONSHIP_TYPES.DERIVED_FROM
      : TRACE_RELATIONSHIP_TYPES.VALIDATED_BY;

  return traceLinks.some((link) => {
    const target = decisionObjects.find(
      (decisionObject) => decisionObject.object_id === link.target_object_id
    );

    return (
      link.source_object_id === requirement.object_id &&
      link.relationship_type === relationshipType &&
      link.required_for_readiness === true &&
      target?.type === targetType
    );
  });
}

function hasAcceptanceCriteriaOrTestLink(
  requirement,
  decisionObjectVersions,
  traceLinks,
  decisionObjects
) {
  const currentVersion = decisionObjectVersions.find(
    (version) =>
      version.object_id === requirement.object_id &&
      version.version_number === requirement.current_version
  );
  const acceptanceCriteria = currentVersion?.content?.acceptance_criteria;
  const hasInlineAcceptanceCriteria =
    Array.isArray(acceptanceCriteria) && acceptanceCriteria.some((item) => `${item}`.trim());

  return (
    hasInlineAcceptanceCriteria &&
    hasRequiredTraceLink(requirement, traceLinks, decisionObjects, DECISION_OBJECT_TYPES.TEST)
  );
}

function hasActiveApprovedCurrentVersion(decisionObject, currentVersion, approvals) {
  if (!currentVersion) {
    return false;
  }

  return approvals.some(
    (approval) =>
      approval.object_id === decisionObject.object_id &&
      approval.version_id === currentVersion.version_id &&
      approval.status === APPROVAL_STATUSES.ACTIVE &&
      approval.decision === APPROVAL_DECISIONS.APPROVED
  );
}

function calculateReadinessScore(blockers) {
  if (blockers.length === 0) {
    return 100;
  }

  const resolvedCount = blockers.filter(
    (blocker) => blocker.status !== BLOCKER_STATUSES.OPEN
  ).length;
  const score = Math.round((resolvedCount / blockers.length) * 100);

  return Math.max(0, Math.min(99, score));
}

function buildReadinessSummary(status, openBlockerCount) {
  if (status === READINESS_STATUSES.READY) {
    return "Project is Ready-to-Build because no unresolved hard blockers remain.";
  }

  return `Project is Not Ready because ${openBlockerCount} unresolved hard blocker${
    openBlockerCount === 1 ? "" : "s"
  } remain.`;
}

function buildStableBlockerId(projectId, objectId, ruleId) {
  return `blocker-${sanitizeIdentifier(projectId)}-${sanitizeIdentifier(objectId)}-${ruleId}`;
}

function sanitizeIdentifier(value) {
  return `${value}`.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "");
}
