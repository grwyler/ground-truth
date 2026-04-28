import {
  DRAFT_REVIEW_STATUSES,
  PERMISSIONS,
  acceptDecisionDraft,
  authorize,
  buildDecisionObjectAuditEvent,
  buildDecisionObjectCreate,
  buildDecisionObjectUpdate,
  isRejectedDecisionDraft,
  rejectDecisionDraft,
  toDecisionObjectSummary,
  toDecisionObjectVersionSummary
} from "../../../../packages/domain/src/index.js";
import { resolveLocalSession } from "../auth/session.js";
import { readJsonBody, sendJson } from "./projects.js";

export function createDecisionObjectsRoute({ projectRepository, now, idGenerator } = {}) {
  if (!projectRepository) {
    throw new Error("A project repository is required.");
  }

  return async function handleDecisionObjectsRoute(request, response) {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    const pathParts = requestUrl.pathname.split("/").filter(Boolean);

    if (
      pathParts.length < 5 ||
      pathParts[0] !== "api" ||
      pathParts[1] !== "v1" ||
      pathParts[2] !== "projects" ||
      pathParts[4] !== "decision-objects"
    ) {
      return false;
    }

    const projectId = pathParts[3];
    const session = resolveLocalSession(request);

    if (!session.isAuthenticated) {
      sendJson(response, 401, { error: "UNAUTHENTICATED" });
      return true;
    }

    const project = projectRepository.findProjectById(projectId);

    if (!project) {
      sendJson(response, 404, { error: "PROJECT_NOT_FOUND" });
      return true;
    }

    if (request.method === "GET" && pathParts.length === 5) {
      const authorization = authorize(session.actor, PERMISSIONS.READ_PROJECT);

      if (!authorization.allowed) {
        sendJson(response, 403, { error: "FORBIDDEN" });
        return true;
      }

      sendJson(response, 200, {
        decisionObjects: listDecisionObjectSummaries(projectRepository, projectId)
      });
      return true;
    }

    if (request.method === "POST" && pathParts.length === 5) {
      const authorization = authorize(session.actor, PERMISSIONS.EDIT_PROJECT);

      if (!authorization.allowed) {
        sendJson(response, 403, { error: "FORBIDDEN" });
        return true;
      }

      const body = await readJsonBody(request);
      const created = buildDecisionObjectCreate(
        {
          ...body,
          projectId
        },
        session.actor,
        { idGenerator, now }
      );

      if (!created.ok) {
        sendJson(response, 400, {
          error: "VALIDATION_ERROR",
          details: created.validation.errors
        });
        return true;
      }

      const auditEvent = buildDecisionObjectAuditEvent(
        created.decisionObject,
        session.actor,
        "created",
        { version_id: created.version.version_id },
        { idGenerator, now }
      );
      const persisted = projectRepository.createDecisionObject(
        created.decisionObject,
        created.version,
        auditEvent
      );

      sendJson(response, 201, {
        decisionObject: toDecisionObjectSummary(
          persisted.decisionObject,
          persisted.version
        )
      });
      return true;
    }

    if (pathParts.length >= 6) {
      const objectId = pathParts[5];
      const decisionObject = projectRepository.findDecisionObject(projectId, objectId);

      if (!decisionObject) {
        sendJson(response, 404, { error: "DECISION_OBJECT_NOT_FOUND" });
        return true;
      }

      const version = projectRepository.findDecisionObjectVersion(
        decisionObject.object_id,
        decisionObject.current_version
      );

      if (request.method === "GET" && pathParts.length === 6) {
        const authorization = authorize(session.actor, PERMISSIONS.READ_PROJECT);

        if (!authorization.allowed) {
          sendJson(response, 403, { error: "FORBIDDEN" });
          return true;
        }

        sendJson(response, 200, {
          decisionObject: toDecisionObjectSummary(decisionObject, version)
        });
        return true;
      }

      if (request.method === "GET" && pathParts.length === 7 && pathParts[6] === "versions") {
        const authorization = authorize(session.actor, PERMISSIONS.READ_PROJECT);

        if (!authorization.allowed) {
          sendJson(response, 403, { error: "FORBIDDEN" });
          return true;
        }

        sendJson(response, 200, {
          versions: projectRepository
            .listDecisionObjectVersions(decisionObject.object_id)
            .map(toDecisionObjectVersionSummary)
        });
        return true;
      }

      if (request.method === "PATCH" && pathParts.length === 6) {
        const authorization = authorize(session.actor, PERMISSIONS.EDIT_PROJECT);

        if (!authorization.allowed) {
          sendJson(response, 403, { error: "FORBIDDEN" });
          return true;
        }

        const body = await readJsonBody(request);
        const approvals = projectRepository.listDecisionObjectApprovals?.(
          decisionObject.object_id
        ) ?? [];
        const update = buildDecisionObjectUpdate(decisionObject, version, body, session.actor, {
          idGenerator,
          now,
          hasExistingApprovals: approvals.length > 0
        });

        if (!update.ok) {
          sendJson(response, 400, {
            error: "VALIDATION_ERROR",
            details: update.validation.errors
          });
          return true;
        }

        const auditEvent = buildDecisionObjectAuditEvent(
          update.decisionObject,
          session.actor,
          "edited",
          {
            version_id: update.version.version_id,
            meaningful_change: update.meaningfulChange
          },
          { idGenerator, now }
        );
        const updated = projectRepository.updateDecisionObject(
          update.decisionObject,
          update.version,
          auditEvent
        );

        sendJson(response, 200, {
          decisionObject: toDecisionObjectSummary(updated.decisionObject, updated.version)
        });
        return true;
      }

      if (
        request.method === "POST" &&
        pathParts.length === 7 &&
        (pathParts[6] === "accept" || pathParts[6] === "reject")
      ) {
        const authorization = authorize(session.actor, PERMISSIONS.EDIT_PROJECT);

        if (!authorization.allowed) {
          sendJson(response, 403, { error: "FORBIDDEN" });
          return true;
        }

        const review =
          pathParts[6] === "accept"
            ? acceptDecisionDraft(decisionObject, version, session.actor, { now })
            : rejectDecisionDraft(decisionObject, version, session.actor, { now });

        if (!review.ok) {
          sendJson(response, 400, {
            error: "VALIDATION_ERROR",
            details: review.validation.errors
          });
          return true;
        }

        const reviewStatus =
          pathParts[6] === "accept"
            ? DRAFT_REVIEW_STATUSES.ACCEPTED
            : DRAFT_REVIEW_STATUSES.REJECTED;
        const auditEvent = buildDecisionObjectAuditEvent(
          review.decisionObject,
          session.actor,
          reviewStatus,
          { version_id: review.version.version_id },
          { idGenerator, now }
        );
        const updated = projectRepository.updateDecisionObjectDraft(
          review.decisionObject,
          review.version,
          auditEvent
        );

        sendJson(response, 200, {
          decisionObject: toDecisionObjectSummary(updated.decisionObject, updated.version),
          excludedFromReadiness: isRejectedDecisionDraft(
            updated.decisionObject,
            updated.version
          )
        });
        return true;
      }
    }

    sendJson(response, 405, { error: "METHOD_NOT_ALLOWED" });
    return true;
  };
}

function listDecisionObjectSummaries(projectRepository, projectId) {
  return projectRepository.listDecisionObjects(projectId).map((decisionObject) => {
    const version = projectRepository.findDecisionObjectVersion(
      decisionObject.object_id,
      decisionObject.current_version
    );

    return toDecisionObjectSummary(decisionObject, version);
  });
}
