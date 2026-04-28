import {
  PERMISSIONS,
  authorize,
  buildReadinessAuditEvent,
  evaluateProjectReadiness,
  toReadinessResponse
} from "../../../../packages/domain/src/index.js";
import { resolveLocalSession } from "../auth/session.js";
import { sendJson } from "./projects.js";

export function createReadinessRoute({ projectRepository, now, idGenerator } = {}) {
  if (!projectRepository) {
    throw new Error("A project repository is required.");
  }

  return async function handleReadinessRoute(request, response) {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    const pathParts = requestUrl.pathname.split("/").filter(Boolean);

    if (
      pathParts.length !== 5 ||
      pathParts[0] !== "api" ||
      pathParts[1] !== "v1" ||
      pathParts[2] !== "projects" ||
      pathParts[4] !== "readiness"
    ) {
      return false;
    }

    const projectId = pathParts[3];
    const session = resolveLocalSession(request);

    if (!session.isAuthenticated) {
      sendJson(response, 401, { error: "UNAUTHENTICATED" });
      return true;
    }

    if (request.method !== "GET") {
      sendJson(response, 405, { error: "METHOD_NOT_ALLOWED" });
      return true;
    }

    const authorization = authorize(session.actor, PERMISSIONS.READ_PROJECT);

    if (!authorization.allowed) {
      sendJson(response, 403, { error: "FORBIDDEN" });
      return true;
    }

    const project = projectRepository.findProjectById(projectId);

    if (!project) {
      sendJson(response, 404, { error: "PROJECT_NOT_FOUND" });
      return true;
    }

    const decisionObjects = projectRepository.listDecisionObjects(projectId);
    const decisionObjectVersions = decisionObjects.flatMap((decisionObject) =>
      projectRepository.listDecisionObjectVersions(decisionObject.object_id)
    );
    const result = evaluateProjectReadiness(
      project,
      {
        decisionObjects,
        decisionObjectVersions,
        traceLinks: projectRepository.listTraceLinks(projectId),
        approvals: projectRepository.listProjectApprovals(projectId),
        overrides: projectRepository.listProjectOverrides(projectId)
      },
      { idGenerator, now }
    );
    const auditEvent = buildReadinessAuditEvent(result.evaluation, session.actor, {
      idGenerator,
      now
    });
    const persisted = projectRepository.saveReadinessEvaluation(
      result.evaluation,
      result.blockers,
      auditEvent
    );

    sendJson(response, 200, {
      readiness: toReadinessResponse(
        {
          ...result,
          evaluation: persisted.evaluation,
          blockers: persisted.blockers
        },
        project
      )
    });
    return true;
  };
}
