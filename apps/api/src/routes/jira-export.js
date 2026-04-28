import {
  PERMISSIONS,
  authorize,
  buildBlockedJiraExportJob,
  buildJiraExportAuditEvent,
  buildJiraExportJob,
  buildJiraExportPreview,
  buildReadinessAuditEvent,
  evaluateProjectReadiness,
  toJiraExportJobSummary
} from "../../../../packages/domain/src/index.js";
import { createMockJiraAdapter } from "../../../../packages/integrations/jira/src/index.js";
import { resolveLocalSession } from "../auth/session.js";
import { readJsonBody, sendJson } from "./projects.js";

export function createJiraExportRoute({
  projectRepository,
  jiraAdapter = createMockJiraAdapter(),
  now,
  idGenerator
} = {}) {
  if (!projectRepository) {
    throw new Error("A project repository is required.");
  }

  return async function handleJiraExportRoute(request, response) {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    const pathParts = requestUrl.pathname.split("/").filter(Boolean);
    const isExportCreate =
      pathParts.length === 7 &&
      pathParts[0] === "api" &&
      pathParts[1] === "v1" &&
      pathParts[2] === "projects" &&
      pathParts[4] === "integrations" &&
      pathParts[5] === "jira" &&
      pathParts[6] === "export";
    const isExportStatus =
      pathParts.length === 8 &&
      pathParts[0] === "api" &&
      pathParts[1] === "v1" &&
      pathParts[2] === "projects" &&
      pathParts[4] === "integrations" &&
      pathParts[5] === "jira" &&
      pathParts[6] === "export-jobs";

    if (!isExportCreate && !isExportStatus) {
      return false;
    }

    const projectId = pathParts[3];
    const session = resolveLocalSession(request);

    if (!session.isAuthenticated) {
      sendJson(response, 401, { error: "UNAUTHENTICATED" });
      return true;
    }

    const requiredPermission = isExportCreate
      ? PERMISSIONS.EXPORT_JIRA
      : PERMISSIONS.READ_PROJECT;
    const authorization = authorize(session.actor, requiredPermission);

    if (!authorization.allowed) {
      sendJson(response, 403, { error: "FORBIDDEN" });
      return true;
    }

    const project = projectRepository.findProjectById(projectId);

    if (!project) {
      sendJson(response, 404, { error: "PROJECT_NOT_FOUND" });
      return true;
    }

    if (isExportStatus) {
      if (request.method !== "GET") {
        sendJson(response, 405, { error: "METHOD_NOT_ALLOWED" });
        return true;
      }

      const exportJob = projectRepository.findJiraExport(projectId, pathParts[7]);

      if (!exportJob) {
        sendJson(response, 404, { error: "JIRA_EXPORT_NOT_FOUND" });
        return true;
      }

      sendJson(response, 200, {
        exportJob: toJiraExportJobSummary(exportJob)
      });
      return true;
    }

    if (request.method !== "POST") {
      sendJson(response, 405, { error: "METHOD_NOT_ALLOWED" });
      return true;
    }

    const body = await readJsonBody(request);
    const exportInputs = getJiraExportInputs(projectRepository, projectId);
    const readinessResult = evaluateProjectReadiness(
      project,
      exportInputs,
      { idGenerator, now }
    );
    const readinessAuditEvent = buildReadinessAuditEvent(
      readinessResult.evaluation,
      session.actor,
      { idGenerator, now }
    );
    const savedReadiness = projectRepository.saveReadinessEvaluation(
      readinessResult.evaluation,
      readinessResult.blockers,
      readinessAuditEvent
    );

    if (readinessResult.evaluation.status !== "ready") {
      const blockedJob = buildBlockedJiraExportJob(
        project,
        body,
        session.actor,
        savedReadiness.blockers.filter((blocker) => blocker.status === "open"),
        { idGenerator, now }
      );
      try {
        const auditEvent = buildJiraExportAuditEvent(blockedJob, session.actor, {
          idGenerator,
          now
        });
        projectRepository.createJiraExport(blockedJob, auditEvent);
      } catch {
        sendJson(response, 500, {
          error: "AUDIT_WRITE_FAILED",
          message: "Jira export was not saved because the audit event could not be recorded."
        });
        return true;
      }

      sendJson(response, 409, {
        error: "PROJECT_NOT_READY",
        message: "Jira export is blocked until Ready-to-Build status is achieved",
        blockers: savedReadiness.blockers
          .filter((blocker) => blocker.status === "open")
          .map((blocker) => ({
            blockerId: blocker.blocker_id,
            objectId: blocker.object_id,
            description: blocker.description
          }))
      });
      return true;
    }

    const previewResult = buildJiraExportPreview(
      project,
      readinessResult,
      exportInputs,
      body,
      session.actor
    );

    if (!previewResult.ok) {
      sendJson(response, 400, {
        error: "VALIDATION_ERROR",
        details: previewResult.validation.errors
      });
      return true;
    }

    const adapterResult = jiraAdapter.exportPreview(previewResult.preview, body);
    const exportJob = buildJiraExportJob(
      project,
      previewResult.preview,
      adapterResult,
      body,
      session.actor,
      { idGenerator, now }
    );
    let persisted;

    try {
      const auditEvent = buildJiraExportAuditEvent(exportJob, session.actor, {
        idGenerator,
        now
      });
      persisted = projectRepository.createJiraExport(exportJob, auditEvent);
    } catch {
      sendJson(response, 500, {
        error: "AUDIT_WRITE_FAILED",
        message: "Jira export was not saved because the audit event could not be recorded."
      });
      return true;
    }

    sendJson(response, 202, {
      exportJob: toJiraExportJobSummary(persisted)
    });
    return true;
  };
}

function getJiraExportInputs(projectRepository, projectId) {
  const decisionObjects = projectRepository.listDecisionObjects(projectId);
  const decisionObjectIds = new Set(
    decisionObjects.map((decisionObject) => decisionObject.object_id)
  );

  return {
    decisionObjects,
    decisionObjectVersions: decisionObjects.flatMap((decisionObject) =>
      projectRepository.listDecisionObjectVersions(decisionObject.object_id)
    ),
    traceLinks: projectRepository.listTraceLinks(projectId),
    approvals: projectRepository
      .listProjectApprovals(projectId)
      .filter((approval) => decisionObjectIds.has(approval.object_id)),
    overrides: projectRepository.listProjectOverrides(projectId)
  };
}
