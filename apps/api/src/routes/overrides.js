import {
  PERMISSIONS,
  authorize,
  buildOverrideAuditEvent,
  buildOverrideRecord,
  buildReadinessAuditEvent,
  evaluateProjectReadiness,
  toBlockerSummary,
  toOverrideSummary,
  toReadinessResponse
} from "../../../../packages/domain/src/index.js";
import { resolveLocalSession } from "../auth/session.js";
import { readJsonBody, sendJson } from "./projects.js";

export function createOverridesRoute({ projectRepository, now, idGenerator } = {}) {
  if (!projectRepository) {
    throw new Error("A project repository is required.");
  }

  return async function handleOverridesRoute(request, response) {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    const pathParts = requestUrl.pathname.split("/").filter(Boolean);

    if (
      pathParts.length !== 5 ||
      pathParts[0] !== "api" ||
      pathParts[1] !== "v1" ||
      pathParts[2] !== "projects" ||
      pathParts[4] !== "overrides"
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

    const authorization = authorize(session.actor, PERMISSIONS.SUBMIT_OVERRIDE);

    if (!authorization.allowed) {
      sendJson(response, 403, { error: "UNAUTHORIZED_OVERRIDE" });
      return true;
    }

    const project = projectRepository.findProjectById(projectId);

    if (!project) {
      sendJson(response, 404, { error: "PROJECT_NOT_FOUND" });
      return true;
    }

    const body = await readJsonBody(request);
    const currentReadiness = evaluateCurrentReadiness(projectRepository, projectId, project, {
      idGenerator,
      now
    });
    const candidateBlockers = mergeBlockers(
      projectRepository.listProjectBlockers(projectId),
      currentReadiness.blockers
    );
    const result = buildOverrideRecord(project, candidateBlockers, body, session.actor, {
      idGenerator,
      now
    });

    if (!result.ok) {
      sendJson(response, 400, {
        error: "VALIDATION_ERROR",
        details: result.validation.errors
      });
      return true;
    }

    let persisted;

    try {
      const auditEvent = buildOverrideAuditEvent(result.override, session.actor, {
        idGenerator,
        now
      });
      persisted = projectRepository.createOverride(
        result.override,
        result.overriddenBlockers,
        auditEvent
      );
    } catch {
      sendJson(response, 500, {
        error: "AUDIT_WRITE_FAILED",
        message: "Override was not saved because the audit event could not be recorded."
      });
      return true;
    }

    const updatedReadiness = evaluateCurrentReadiness(
      projectRepository,
      projectId,
      project,
      { idGenerator, now }
    );
    const readinessAuditEvent = buildReadinessAuditEvent(
      updatedReadiness.evaluation,
      session.actor,
      { idGenerator, now }
    );
    const savedReadiness = projectRepository.saveReadinessEvaluation(
      updatedReadiness.evaluation,
      updatedReadiness.blockers,
      readinessAuditEvent
    );

    sendJson(response, 201, {
      override: toOverrideSummary(persisted.override),
      overriddenBlockers: persisted.overriddenBlockers.map(toBlockerSummary),
      readiness: toReadinessResponse(
        {
          ...updatedReadiness,
          evaluation: savedReadiness.evaluation,
          blockers: savedReadiness.blockers
        },
        project
      )
    });
    return true;
  };
}

function evaluateCurrentReadiness(projectRepository, projectId, project, options) {
  const decisionObjects = projectRepository.listDecisionObjects(projectId);
  const decisionObjectVersions = decisionObjects.flatMap((decisionObject) =>
    projectRepository.listDecisionObjectVersions(decisionObject.object_id)
  );

  return evaluateProjectReadiness(
    project,
    {
      decisionObjects,
      decisionObjectVersions,
      traceLinks: projectRepository.listTraceLinks(projectId),
      approvals: projectRepository.listProjectApprovals(projectId),
      overrides: projectRepository.listProjectOverrides(projectId)
    },
    options
  );
}

function mergeBlockers(...blockerGroups) {
  return [
    ...new Map(
      blockerGroups
        .flat()
        .filter(Boolean)
        .map((blocker) => [blocker.blocker_id, blocker])
    ).values()
  ];
}
