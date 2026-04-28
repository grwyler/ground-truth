import { canExportToJira } from "./auth.js";
import {
  APPROVAL_DECISIONS,
  APPROVAL_STATUSES,
  AUDIT_EVENT_TYPES,
  CERTIFICATION_PACKAGE_STATUSES,
  DECISION_OBJECT_TYPES,
  READINESS_STATUSES
} from "./models/index.js";
import { toApprovalSummary } from "./approvals.js";
import { toDecisionObjectSummary } from "./ai.js";
import { toBlockerSummary, toReadinessResponse } from "./readiness.js";
import { toOverrideSummary } from "./overrides.js";
import { toTraceLinkSummary } from "./traceability.js";

export const CERTIFICATION_PACKAGE_SCHEMA_VERSION = "mvp-certification-package-v1";

export function buildCertificationPackage(
  project,
  readinessResult,
  {
    decisionObjects = [],
    decisionObjectVersions = [],
    traceLinks = [],
    approvals = [],
    overrides = []
  } = {},
  input = {},
  actor,
  { idGenerator, now = new Date() } = {}
) {
  const errors = [];

  if (!project?.project_id) {
    errors.push("CERTIFICATION_PROJECT_REQUIRED");
  }

  if (!canExportToJira(actor)) {
    errors.push("CERTIFICATION_UNAUTHORIZED");
  }

  if (readinessResult?.evaluation?.status !== READINESS_STATUSES.READY) {
    errors.push("PROJECT_NOT_READY");
  }

  if (errors.length > 0) {
    return Object.freeze({
      ok: false,
      validation: freezeValidation(errors)
    });
  }

  const generatedAt = now.toISOString();
  const includeTraceabilityMatrix = input.includeTraceabilityMatrix !== false;
  const includeApprovals = input.includeApprovals !== false;
  const includeRisks = input.includeRisks !== false;
  const includeOverrides = input.includeOverrides !== false;
  const packageId = idGenerator?.("certification-package") ?? `cert-package-${project.project_id}-${Date.now()}`;
  const activeDecisionObjects = decisionObjects.filter(
    (decisionObject) => decisionObject.status !== "rejected"
  );
  const versionByObjectId = new Map(
    decisionObjectVersions.map((version) => [version.object_id, version])
  );
  const decisionObjectById = new Map(
    activeDecisionObjects.map((decisionObject) => [decisionObject.object_id, decisionObject])
  );
  const approvedVersionIds = new Set(
    approvals
      .filter(
        (approval) =>
          approval.status === APPROVAL_STATUSES.ACTIVE &&
          approval.decision === APPROVAL_DECISIONS.APPROVED
      )
      .map((approval) => approval.version_id)
  );
  const includedDecisionObjects = activeDecisionObjects.map((decisionObject) => {
    const version = versionByObjectId.get(decisionObject.object_id);

    return Object.freeze({
      ...toDecisionObjectSummary(decisionObject, version),
      includedVersionId: version?.version_id ?? null,
      approvedForCurrentVersion: version ? approvedVersionIds.has(version.version_id) : false
    });
  });
  const traceabilityMatrix = traceLinks.map((traceLink) =>
    toTraceLinkSummary(
      traceLink,
      decisionObjectById.get(traceLink.source_object_id),
      decisionObjectById.get(traceLink.target_object_id)
    )
  );
  const approvalSummaries = approvals.map((approval) =>
    toApprovalSummary(
      approval,
      decisionObjectById.get(approval.object_id),
      decisionObjectVersions.find((version) => version.version_id === approval.version_id)
    )
  );
  const riskSummaries = includedDecisionObjects.filter(
    (decisionObject) => decisionObject.type === DECISION_OBJECT_TYPES.RISK
  );
  const blockerSummaries = readinessResult.blockers.map(toBlockerSummary);
  const overrideSummaries = overrides.map(toOverrideSummary);
  const artifact = Object.freeze({
    schemaVersion: CERTIFICATION_PACKAGE_SCHEMA_VERSION,
    packageId,
    project: Object.freeze({
      projectId: project.project_id,
      name: project.name,
      readinessStatus: readinessResult.evaluation.status,
      readinessScore: readinessResult.evaluation.readiness_score
    }),
    generatedAt,
    generatedBy: actor.id,
    readiness: toReadinessResponse(readinessResult, project),
    includedDecisionObjects: Object.freeze(includedDecisionObjects),
    traceabilityMatrix: Object.freeze(includeTraceabilityMatrix ? traceabilityMatrix : []),
    approvals: Object.freeze(includeApprovals ? approvalSummaries : []),
    risks: Object.freeze(includeRisks ? riskSummaries : []),
    blockers: Object.freeze(blockerSummaries),
    overrides: Object.freeze(includeOverrides ? overrideSummaries : [])
  });
  const packageRecord = Object.freeze({
    package_id: packageId,
    project_id: project.project_id,
    status: CERTIFICATION_PACKAGE_STATUSES.GENERATED,
    generated_by: actor.id,
    generated_at: generatedAt,
    package_uri: `local://certification-packages/${project.project_id}/${packageId}.json`,
    includes_traceability_matrix: includeTraceabilityMatrix,
    includes_approvals: includeApprovals,
    includes_risks: includeRisks,
    includes_overrides: includeOverrides
  });

  return Object.freeze({
    ok: true,
    package: packageRecord,
    artifact
  });
}

export function buildCertificationPackageAuditEvent(
  packageRecord,
  actor,
  { idGenerator, now = new Date() } = {}
) {
  return Object.freeze({
    audit_event_id:
      idGenerator?.("audit") ?? `audit-${packageRecord.package_id}-${Date.now()}`,
    project_id: packageRecord.project_id,
    actor_id: actor.id,
    event_type: AUDIT_EVENT_TYPES.CREATE,
    entity_type: "certification_package",
    entity_id: packageRecord.package_id,
    timestamp: now.toISOString(),
    details: Object.freeze({
      package_uri: packageRecord.package_uri,
      status: packageRecord.status,
      includes_traceability_matrix: packageRecord.includes_traceability_matrix,
      includes_approvals: packageRecord.includes_approvals,
      includes_risks: packageRecord.includes_risks,
      includes_overrides: packageRecord.includes_overrides
    }),
    immutable_hash: null
  });
}

export function toCertificationPackageSummary(packageRecord, artifact = null) {
  return Object.freeze({
    packageId: packageRecord.package_id,
    projectId: packageRecord.project_id,
    status: packageRecord.status,
    generatedBy: packageRecord.generated_by,
    generatedAt: packageRecord.generated_at,
    packageUri: packageRecord.package_uri,
    downloadUrl: packageRecord.package_uri,
    includesTraceabilityMatrix: packageRecord.includes_traceability_matrix,
    includesApprovals: packageRecord.includes_approvals,
    includesRisks: packageRecord.includes_risks,
    includesOverrides: packageRecord.includes_overrides,
    artifact
  });
}

function freezeValidation(errors) {
  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze([...new Set(errors)])
  });
}
