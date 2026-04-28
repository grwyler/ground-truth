import {
  PERMISSIONS,
  authorize,
  toAuditEventSummary
} from "../../../../packages/domain/src/index.js";
import { resolveLocalSession } from "../auth/session.js";
import { sendJson } from "./projects.js";

export function createAuditRoute({ projectRepository } = {}) {
  if (!projectRepository) {
    throw new Error("A project repository is required.");
  }

  return async function handleAuditRoute(request, response) {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    const pathParts = requestUrl.pathname.split("/").filter(Boolean);

    if (
      pathParts.length !== 5 ||
      pathParts[0] !== "api" ||
      pathParts[1] !== "v1" ||
      pathParts[2] !== "projects" ||
      pathParts[4] !== "audit"
    ) {
      return false;
    }

    const projectId = pathParts[3];
    const session = resolveLocalSession(request);

    if (!session.isAuthenticated) {
      sendJson(response, 401, { error: "UNAUTHENTICATED" });
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

    if (request.method !== "GET") {
      sendJson(response, 405, { error: "METHOD_NOT_ALLOWED" });
      return true;
    }

    sendJson(response, 200, {
      auditEvents: projectRepository.listAuditEvents(projectId).map(toAuditEventSummary)
    });
    return true;
  };
}
