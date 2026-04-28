import {
  DRAFT_REVIEW_STATUSES,
  PERMISSIONS,
  TRACE_RELATIONSHIP_TYPES,
  acceptDecisionDraft,
  authorize,
  buildAcceptanceCriteriaCreate,
  buildDecisionObjectAuditEvent,
  buildDecisionObjectCreate,
  buildDecisionObjectUpdate,
  buildOwnerAssignment,
  buildOwnerAssignmentAuditEvent,
  buildTraceLinkAuditEvent,
  buildTraceLinkCreate,
  isRejectedDecisionDraft,
  rejectDecisionDraft,
  toAcceptanceCriteriaSummary,
  toAssignableOwnerSummary,
  toDecisionObjectSummary,
  toDecisionObjectVersionSummary,
  toTraceLinkSummary
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

      if (pathParts.length >= 7 && pathParts[6] === "links") {
        if (request.method === "GET" && pathParts.length === 7) {
          const authorization = authorize(session.actor, PERMISSIONS.READ_PROJECT);

          if (!authorization.allowed) {
            sendJson(response, 403, { error: "FORBIDDEN" });
            return true;
          }

          sendJson(response, 200, {
            traceLinks: listTraceLinkSummaries(projectRepository, projectId, objectId)
          });
          return true;
        }

        if (request.method === "POST" && pathParts.length === 7) {
          const authorization = authorize(session.actor, PERMISSIONS.EDIT_PROJECT);

          if (!authorization.allowed) {
            sendJson(response, 403, { error: "FORBIDDEN" });
            return true;
          }

          const body = await readJsonBody(request);
          const targetObjectId = body.targetObjectId ?? body.target_object_id;
          const targetObject = projectRepository.findDecisionObject(projectId, targetObjectId);
          const traceLinkCreate = buildTraceLinkCreate(
            decisionObject,
            targetObject,
            body,
            session.actor,
            { idGenerator, now }
          );

          if (!traceLinkCreate.ok) {
            sendJson(response, 400, {
              error: "VALIDATION_ERROR",
              details: traceLinkCreate.validation.errors
            });
            return true;
          }

          const auditEvent = buildTraceLinkAuditEvent(
            traceLinkCreate.traceLink,
            session.actor,
            "created",
            { idGenerator, now }
          );
          const traceLink = projectRepository.createTraceLink(
            traceLinkCreate.traceLink,
            auditEvent
          );

          sendJson(response, 201, {
            traceLink: toTraceLinkSummary(traceLink, decisionObject, targetObject)
          });
          return true;
        }

        if (request.method === "DELETE" && pathParts.length === 8) {
          const authorization = authorize(session.actor, PERMISSIONS.EDIT_PROJECT);

          if (!authorization.allowed) {
            sendJson(response, 403, { error: "FORBIDDEN" });
            return true;
          }

          const traceLink = projectRepository.findTraceLink(projectId, pathParts[7]);

          if (
            !traceLink ||
            (traceLink.source_object_id !== objectId && traceLink.target_object_id !== objectId)
          ) {
            sendJson(response, 404, { error: "TRACE_LINK_NOT_FOUND" });
            return true;
          }

          const auditEvent = buildTraceLinkAuditEvent(traceLink, session.actor, "deleted", {
            idGenerator,
            now
          });
          const deletedTraceLink = projectRepository.deleteTraceLink(
            projectId,
            pathParts[7],
            auditEvent
          );

          sendJson(response, 200, {
            traceLink: toTraceLinkSummary(
              deletedTraceLink,
              projectRepository.findDecisionObject(projectId, deletedTraceLink.source_object_id),
              projectRepository.findDecisionObject(projectId, deletedTraceLink.target_object_id)
            )
          });
          return true;
        }
      }

      if (pathParts.length >= 7 && pathParts[6] === "acceptance-criteria") {
        if (request.method === "GET" && pathParts.length === 7) {
          const authorization = authorize(session.actor, PERMISSIONS.READ_PROJECT);

          if (!authorization.allowed) {
            sendJson(response, 403, { error: "FORBIDDEN" });
            return true;
          }

          sendJson(response, 200, {
            acceptanceCriteria: listAcceptanceCriteriaSummaries(
              projectRepository,
              projectId,
              objectId
            )
          });
          return true;
        }

        if (request.method === "POST" && pathParts.length === 7) {
          const authorization = authorize(session.actor, PERMISSIONS.EDIT_PROJECT);

          if (!authorization.allowed) {
            sendJson(response, 403, { error: "FORBIDDEN" });
            return true;
          }

          const body = await readJsonBody(request);
          const created = buildAcceptanceCriteriaCreate(
            decisionObject,
            body,
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

          const objectAuditEvent = buildDecisionObjectAuditEvent(
            created.decisionObject,
            session.actor,
            "created",
            {
              version_id: created.version.version_id,
              requirement_object_id: decisionObject.object_id
            },
            { idGenerator, now }
          );
          const traceAuditEvent = buildTraceLinkAuditEvent(
            created.traceLink,
            session.actor,
            "created",
            { idGenerator, now }
          );
          const persisted = projectRepository.createAcceptanceCriteria(
            created.decisionObject,
            created.version,
            created.traceLink,
            [objectAuditEvent, traceAuditEvent]
          );

          sendJson(response, 201, {
            acceptanceCriteria: toAcceptanceCriteriaSummary(
              persisted.decisionObject,
              persisted.version,
              persisted.traceLink
            ),
            traceLink: toTraceLinkSummary(
              persisted.traceLink,
              decisionObject,
              persisted.decisionObject
            )
          });
          return true;
        }
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

      if (request.method === "PATCH" && pathParts.length === 7 && pathParts[6] === "owner") {
        const authorization = authorize(session.actor, PERMISSIONS.MANAGE_PROJECT);

        if (!authorization.allowed) {
          sendJson(response, 403, { error: "FORBIDDEN" });
          return true;
        }

        const body = await readJsonBody(request);
        const assignment = buildOwnerAssignment(
          decisionObject,
          body,
          session.actor,
          {
            assignableOwners: listAssignableOwnerSummaries(projectRepository, projectId),
            now
          }
        );

        if (!assignment.ok) {
          sendJson(response, 400, {
            error: "VALIDATION_ERROR",
            details: assignment.validation.errors
          });
          return true;
        }

        const auditEvent = buildOwnerAssignmentAuditEvent(assignment, session.actor, {
          idGenerator,
          now
        });
        const updatedDecisionObject = projectRepository.assignDecisionObjectOwner(
          assignment.decisionObject,
          auditEvent
        );

        sendJson(response, 200, {
          decisionObject: toDecisionObjectSummary(updatedDecisionObject, version)
        });
        return true;
      }

      if (request.method === "PATCH" && pathParts.length === 6) {
        const body = await readJsonBody(request);
        const changesOwner =
          body.ownerId !== undefined || body.owner_id !== undefined;
        const authorization = authorize(
          session.actor,
          changesOwner ? PERMISSIONS.MANAGE_PROJECT : PERMISSIONS.EDIT_PROJECT
        );

        if (!authorization.allowed) {
          sendJson(response, 403, { error: "FORBIDDEN" });
          return true;
        }

        if (changesOwner) {
          const assignmentValidation = buildOwnerAssignment(
            decisionObject,
            body,
            session.actor,
            {
              assignableOwners: listAssignableOwnerSummaries(projectRepository, projectId),
              now
            }
          );

          if (!assignmentValidation.ok) {
            sendJson(response, 400, {
              error: "VALIDATION_ERROR",
              details: assignmentValidation.validation.errors
            });
            return true;
          }
        }

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

function listAssignableOwnerSummaries(projectRepository, projectId) {
  return (projectRepository.listProjectAssignableOwners?.(projectId) ?? []).map(
    ({ user, roleAssignment }) => toAssignableOwnerSummary(user, roleAssignment)
  );
}

function listTraceLinkSummaries(projectRepository, projectId, objectId) {
  return (projectRepository.listTraceLinks?.(projectId, objectId) ?? []).map((traceLink) =>
    toTraceLinkSummary(
      traceLink,
      projectRepository.findDecisionObject(projectId, traceLink.source_object_id),
      projectRepository.findDecisionObject(projectId, traceLink.target_object_id)
    )
  );
}

function listAcceptanceCriteriaSummaries(projectRepository, projectId, requirementObjectId) {
  return (projectRepository.listTraceLinks?.(projectId, requirementObjectId) ?? [])
    .filter(
      (traceLink) =>
        traceLink.source_object_id === requirementObjectId &&
        traceLink.relationship_type === TRACE_RELATIONSHIP_TYPES.VALIDATED_BY
    )
    .map((traceLink) => {
      const testObject = projectRepository.findDecisionObject(
        projectId,
        traceLink.target_object_id
      );
      const version = testObject
        ? projectRepository.findDecisionObjectVersion(
            testObject.object_id,
            testObject.current_version
          )
        : null;

      return testObject && version
        ? toAcceptanceCriteriaSummary(testObject, version, traceLink)
        : null;
    })
    .filter(Boolean);
}
