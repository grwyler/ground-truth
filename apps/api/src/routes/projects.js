import {
  PERMISSIONS,
  authorize,
  buildProjectCreatedAuditEvent,
  buildProjectRecord,
  toProjectSummary
} from "../../../../packages/domain/src/index.js";
import { resolveLocalSession } from "../auth/session.js";

const JSON_HEADERS = Object.freeze({
  "content-type": "application/json; charset=utf-8"
});

export function createProjectsRoute({ projectRepository, now, idGenerator } = {}) {
  if (!projectRepository) {
    throw new Error("A project repository is required.");
  }

  return async function handleProjectsRoute(request, response) {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");

    if (
      requestUrl.pathname !== "/api/v1/projects" &&
      !requestUrl.pathname.startsWith("/api/v1/projects/")
    ) {
      return false;
    }

    const pathParts = requestUrl.pathname.split("/").filter(Boolean);
    const projectId = pathParts[3];
    const session = resolveLocalSession(request);

    if (!session.isAuthenticated) {
      sendJson(response, 401, { error: "UNAUTHENTICATED" });
      return true;
    }

    if (request.method === "GET" && pathParts.length === 3) {
      const authorization = authorize(session.actor, PERMISSIONS.READ_PROJECT);

      if (!authorization.allowed) {
        sendJson(response, 403, { error: "FORBIDDEN" });
        return true;
      }

      sendJson(response, 200, {
        projects: projectRepository.listProjects().map(toProjectSummary)
      });
      return true;
    }

    if (request.method === "GET" && pathParts.length === 4 && projectId) {
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

      sendJson(response, 200, { project: toProjectSummary(project) });
      return true;
    }

    if (request.method === "POST" && pathParts.length === 3) {
      const authorization = authorize(session.actor, PERMISSIONS.MANAGE_PROJECT);

      if (!authorization.allowed) {
        sendJson(response, 403, { error: "FORBIDDEN" });
        return true;
      }

      const body = await readJsonBody(request);
      const result = buildProjectRecord(body, session.actor, { now, idGenerator });

      if (!result.ok) {
        sendJson(response, 400, {
          error: "VALIDATION_ERROR",
          message: "Project name is required",
          details: result.validation.errors
        });
        return true;
      }

      const auditEvent = buildProjectCreatedAuditEvent(result.project, session.actor, {
        idGenerator
      });
      const project = projectRepository.createProject(result.project, auditEvent);

      sendJson(response, 201, { project: toProjectSummary(project) });
      return true;
    }

    sendJson(response, 405, { error: "METHOD_NOT_ALLOWED" });
    return true;
  };
}

export function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, JSON_HEADERS);
  response.end(JSON.stringify(body));
}

async function readJsonBody(request) {
  let rawBody = "";

  for await (const chunk of request) {
    rawBody += chunk;
  }

  if (!rawBody.trim()) {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    return {};
  }
}
