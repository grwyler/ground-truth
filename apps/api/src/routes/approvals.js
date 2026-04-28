import {
  PERMISSIONS,
  APPROVAL_STATUSES,
  DECISION_OBJECT_TYPES,
  TRACE_RELATIONSHIP_TYPES,
  authorize,
  buildVersionDiff,
  buildApprovalAuditEvent,
  buildApprovalDecision,
  isApprovalQueueItemForActor,
  toApprovalQueueItem,
  toApprovalSummary,
  toDecisionObjectSummary
} from "../../../../packages/domain/src/index.js";
import { resolveLocalSession } from "../auth/session.js";
import { readJsonBody, sendJson } from "./projects.js";

export function createApprovalsRoute({ projectRepository, now, idGenerator } = {}) {
  if (!projectRepository) {
    throw new Error("A project repository is required.");
  }

  return async function handleApprovalsRoute(request, response) {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    const pathParts = requestUrl.pathname.split("/").filter(Boolean);

    if (
      pathParts.length < 5 ||
      pathParts[0] !== "api" ||
      pathParts[1] !== "v1" ||
      pathParts[2] !== "projects"
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

    if (request.method === "GET" && pathParts.length === 5 && pathParts[4] === "approvals") {
      const authorization = authorize(session.actor, PERMISSIONS.READ_PROJECT);

      if (!authorization.allowed) {
        sendJson(response, 403, { error: "FORBIDDEN" });
        return true;
      }

      sendJson(response, 200, {
        approvals: listProjectApprovalSummaries(projectRepository, projectId),
        queue: listApprovalQueue(projectRepository, projectId, session.actor)
      });
      return true;
    }

    if (
      request.method === "POST" &&
      pathParts.length === 7 &&
      pathParts[4] === "decision-objects" &&
      pathParts[6] === "approvals"
    ) {
      const authorization = authorize(session.actor, PERMISSIONS.APPROVE_DECISION);

      if (!authorization.allowed) {
        sendJson(response, 403, { error: "FORBIDDEN" });
        return true;
      }

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
      const body = await readJsonBody(request);
      const result = buildApprovalDecision(decisionObject, version, body, session.actor, {
        idGenerator,
        now
      });

      if (!result.ok) {
        sendJson(response, 400, {
          error: result.validation.errors.includes("APPROVAL_UNAUTHORIZED_APPROVER")
            ? "UNAUTHORIZED_APPROVER"
            : "VALIDATION_ERROR",
          details: result.validation.errors
        });
        return true;
      }

      let persisted;

      try {
        const auditEvent = buildApprovalAuditEvent(
          result.approval,
          result.decisionObject,
          session.actor,
          { idGenerator, now }
        );
        persisted = projectRepository.createApproval(
          result.approval,
          result.decisionObject,
          auditEvent
        );
      } catch {
        sendJson(response, 500, {
          error: "AUDIT_WRITE_FAILED",
          message: "Approval was not saved because the audit event could not be recorded."
        });
        return true;
      }

      sendJson(response, 201, {
        approval: toApprovalSummary(persisted.approval, persisted.decisionObject, version),
        decisionObject: toDecisionObjectSummary(persisted.decisionObject, version)
      });
      return true;
    }

    return false;
  };
}

function listApprovalQueue(projectRepository, projectId, actor) {
  return projectRepository
    .listDecisionObjects(projectId)
    .map((decisionObject) => {
      const version = projectRepository.findDecisionObjectVersion(
        decisionObject.object_id,
        decisionObject.current_version
      );
      const approvals = projectRepository.listDecisionObjectApprovals(decisionObject.object_id);

      return { decisionObject, version, approvals };
    })
    .filter(({ decisionObject, version, approvals }) =>
      isApprovalQueueItemForActor(decisionObject, version, approvals, actor)
    )
    .map(({ decisionObject, version, approvals }) => {
      const latestInvalidatedApproval = approvals
        .filter((approval) => approval.status === APPROVAL_STATUSES.INVALIDATED)
        .at(-1);
      const previousVersion = latestInvalidatedApproval
        ? projectRepository
            .listDecisionObjectVersions(decisionObject.object_id)
            .find((candidate) => candidate.version_id === latestInvalidatedApproval.version_id)
        : null;
      const diff =
        previousVersion && version
          ? buildVersionDiff(decisionObject, previousVersion, version)
          : null;

      return {
        ...toApprovalQueueItem(decisionObject, version, approvals),
        traceabilityStatus: summarizeTraceabilityForApproval(
          projectRepository,
          projectId,
          decisionObject
        ),
        invalidatedApproval: latestInvalidatedApproval
          ? toApprovalSummary(latestInvalidatedApproval, decisionObject, previousVersion)
          : null,
        diff: diff?.ok ? diff.diff : null
      };
    });
}

function listProjectApprovalSummaries(projectRepository, projectId) {
  return projectRepository.listProjectApprovals(projectId).map((approval) => {
    const decisionObject = projectRepository
      .listDecisionObjects(projectId)
      .find((candidate) => candidate.object_id === approval.object_id);
    const version = decisionObject
      ? projectRepository
          .listDecisionObjectVersions(decisionObject.object_id)
          .find((candidate) => candidate.version_id === approval.version_id)
      : null;

    return toApprovalSummary(approval, decisionObject, version);
  });
}

function summarizeTraceabilityForApproval(projectRepository, projectId, decisionObject) {
  if (decisionObject.type !== DECISION_OBJECT_TYPES.REQUIREMENT) {
    return "Traceability is not required for this object type.";
  }

  const links = projectRepository.listTraceLinks(projectId, decisionObject.object_id);
  const hasWorkflowLink = links.some((link) => {
    const target = projectRepository.findDecisionObject(projectId, link.target_object_id);

    return (
      link.source_object_id === decisionObject.object_id &&
      link.relationship_type === TRACE_RELATIONSHIP_TYPES.DERIVED_FROM &&
      target?.type === DECISION_OBJECT_TYPES.WORKFLOW
    );
  });
  const hasTestLink = links.some((link) => {
    const target = projectRepository.findDecisionObject(projectId, link.target_object_id);

    return (
      link.source_object_id === decisionObject.object_id &&
      link.relationship_type === TRACE_RELATIONSHIP_TYPES.VALIDATED_BY &&
      target?.type === DECISION_OBJECT_TYPES.TEST
    );
  });

  return `Workflow ${hasWorkflowLink ? "linked" : "missing"}; test ${
    hasTestLink ? "linked" : "missing"
  }.`;
}
