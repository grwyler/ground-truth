import {
  PERMISSIONS,
  authorize,
  buildCertificationPackage,
  buildCertificationPackageAuditEvent,
  buildReadinessAuditEvent,
  evaluateProjectReadiness,
  toCertificationPackageSummary
} from "../../../../packages/domain/src/index.js";
import { resolveLocalSession } from "../auth/session.js";
import { readJsonBody, sendJson } from "./projects.js";

export function createCertificationPackageRoute({
  projectRepository,
  now,
  idGenerator
} = {}) {
  if (!projectRepository) {
    throw new Error("A project repository is required.");
  }

  return async function handleCertificationPackageRoute(request, response) {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    const pathParts = requestUrl.pathname.split("/").filter(Boolean);

    if (
      pathParts.length !== 5 ||
      pathParts[0] !== "api" ||
      pathParts[1] !== "v1" ||
      pathParts[2] !== "projects" ||
      pathParts[4] !== "certification-package"
    ) {
      return false;
    }

    const projectId = pathParts[3];
    const session = resolveLocalSession(request);

    if (!session.isAuthenticated) {
      sendJson(response, 401, { error: "UNAUTHENTICATED" });
      return true;
    }

    if (request.method !== "POST") {
      sendJson(response, 405, { error: "METHOD_NOT_ALLOWED" });
      return true;
    }

    const authorization = authorize(session.actor, PERMISSIONS.EXPORT_JIRA);

    if (!authorization.allowed) {
      sendJson(response, 403, { error: "FORBIDDEN" });
      return true;
    }

    const project = projectRepository.findProjectById(projectId);

    if (!project) {
      sendJson(response, 404, { error: "PROJECT_NOT_FOUND" });
      return true;
    }

    const body = await readJsonBody(request);
    const packageInputs = getCertificationInputs(projectRepository, projectId);
    const readinessResult = evaluateProjectReadiness(
      project,
      {
        decisionObjects: packageInputs.decisionObjects,
        decisionObjectVersions: packageInputs.decisionObjectVersions,
        traceLinks: packageInputs.traceLinks,
        approvals: packageInputs.approvals,
        overrides: packageInputs.overrides
      },
      { idGenerator, now }
    );

    if (readinessResult.evaluation.status !== "ready") {
      const auditEvent = buildReadinessAuditEvent(readinessResult.evaluation, session.actor, {
        idGenerator,
        now
      });
      const savedReadiness = projectRepository.saveReadinessEvaluation(
        readinessResult.evaluation,
        readinessResult.blockers,
        auditEvent
      );

      sendJson(response, 409, {
        error: "PROJECT_NOT_READY",
        message: "Project is not Ready-to-Build",
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

    const result = buildCertificationPackage(
      project,
      readinessResult,
      packageInputs,
      body,
      session.actor,
      { idGenerator, now }
    );

    if (!result.ok) {
      sendJson(response, 400, {
        error: "VALIDATION_ERROR",
        details: result.validation.errors
      });
      return true;
    }

    const readinessAuditEvent = buildReadinessAuditEvent(
      readinessResult.evaluation,
      session.actor,
      { idGenerator, now }
    );
    projectRepository.saveReadinessEvaluation(
      readinessResult.evaluation,
      readinessResult.blockers,
      readinessAuditEvent
    );
    const auditEvent = buildCertificationPackageAuditEvent(result.package, session.actor, {
      idGenerator,
      now
    });
    const persisted = projectRepository.createCertificationPackage(result.package, auditEvent);

    sendJson(response, 201, {
      package: toCertificationPackageSummary(persisted, result.artifact)
    });
    return true;
  };
}

function getCertificationInputs(projectRepository, projectId) {
  const decisionObjects = projectRepository.listDecisionObjects(projectId);
  const decisionObjectVersions = decisionObjects.flatMap((decisionObject) =>
    projectRepository.listDecisionObjectVersions(decisionObject.object_id)
  );

  return {
    decisionObjects,
    decisionObjectVersions,
    traceLinks: projectRepository.listTraceLinks(projectId),
    approvals: projectRepository.listProjectApprovals(projectId),
    overrides: projectRepository.listProjectOverrides(projectId)
  };
}
