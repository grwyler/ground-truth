import { createDeterministicDraftAdapter } from "../../../../packages/ai/src/index.js";
import {
  AI_JOB_STATUSES,
  AI_SYSTEM_ACTOR,
  PERMISSIONS,
  authorize,
  buildAiGenerationAuditEvent,
  buildQueuedAiGenerationJob,
  markAiGenerationJobCompleted,
  markAiGenerationJobFailed,
  markAiGenerationJobRunning,
  normalizeAiDraftOutput,
  toAiGenerationJobSummary,
  toDecisionObjectSummary
} from "../../../../packages/domain/src/index.js";
import { resolveLocalSession } from "../auth/session.js";
import { sendJson } from "./projects.js";

export function createAiRoute({
  projectRepository,
  aiDraftAdapter = createDeterministicDraftAdapter(),
  now,
  idGenerator
} = {}) {
  if (!projectRepository) {
    throw new Error("A project repository is required.");
  }

  return async function handleAiRoute(request, response) {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    const pathParts = requestUrl.pathname.split("/").filter(Boolean);

    if (
      pathParts.length < 6 ||
      pathParts[0] !== "api" ||
      pathParts[1] !== "v1" ||
      pathParts[2] !== "projects" ||
      pathParts[4] !== "ai"
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

    if (
      request.method === "POST" &&
      pathParts.length === 6 &&
      pathParts[5] === "generate-draft"
    ) {
      const authorization = authorize(session.actor, PERMISSIONS.GENERATE_AI_DRAFT);

      if (!authorization.allowed) {
        sendJson(response, 403, { error: "FORBIDDEN" });
        return true;
      }

      const documents = projectRepository.listDocuments(projectId);
      const jobResult = buildQueuedAiGenerationJob(
        {
          projectId,
          documents
        },
        session.actor,
        {
          now,
          idGenerator
        }
      );

      if (!jobResult.ok) {
        sendJson(response, 400, {
          error: "VALIDATION_ERROR",
          details: jobResult.validation.errors
        });
        return true;
      }

      let job = projectRepository.createAiGenerationJob(jobResult.job);
      job = projectRepository.updateAiGenerationJob(markAiGenerationJobRunning(job));

      try {
        const output = await aiDraftAdapter.generateDraft({ project, documents });
        const normalized = normalizeAiDraftOutput(output, job, AI_SYSTEM_ACTOR, {
          now,
          idGenerator
        });

        if (!normalized.ok) {
          throw new Error(normalized.validation.errors.join(", "));
        }

        const completedJob = markAiGenerationJobCompleted(job, { now });
        const persistedDrafts = projectRepository.createDecisionDrafts(
          normalized.decisionObjects,
          normalized.decisionObjectVersions
        );
        const auditEvent = buildAiGenerationAuditEvent(
          completedJob,
          AI_SYSTEM_ACTOR,
          {
            generated_decision_object_count: persistedDrafts.decisionObjects.length
          },
          { idGenerator }
        );
        job = projectRepository.updateAiGenerationJob(completedJob, auditEvent);

        sendJson(response, 201, {
          job: toAiGenerationJobSummary(job),
          decisionObjects: summarizeDecisionDrafts(projectRepository, persistedDrafts)
        });
        return true;
      } catch (error) {
        const failedJob = markAiGenerationJobFailed(job, error.message, { now });
        const auditEvent = buildAiGenerationAuditEvent(
          failedJob,
          AI_SYSTEM_ACTOR,
          {
            error_message: failedJob.error_message
          },
          { idGenerator }
        );
        job = projectRepository.updateAiGenerationJob(failedJob, auditEvent);

        sendJson(response, 500, {
          error: AI_JOB_STATUSES.FAILED,
          job: toAiGenerationJobSummary(job),
          message: "AI draft generation failed. Uploaded documents remain available."
        });
        return true;
      }
    }

    if (
      request.method === "GET" &&
      pathParts.length === 7 &&
      pathParts[5] === "generation-jobs"
    ) {
      const authorization = authorize(session.actor, PERMISSIONS.READ_PROJECT);

      if (!authorization.allowed) {
        sendJson(response, 403, { error: "FORBIDDEN" });
        return true;
      }

      const job = projectRepository.findAiGenerationJob(projectId, pathParts[6]);

      if (!job) {
        sendJson(response, 404, { error: "AI_GENERATION_JOB_NOT_FOUND" });
        return true;
      }

      sendJson(response, 200, { job: toAiGenerationJobSummary(job) });
      return true;
    }

    sendJson(response, 405, { error: "METHOD_NOT_ALLOWED" });
    return true;
  };
}

function summarizeDecisionDrafts(projectRepository, persistedDrafts) {
  return persistedDrafts.decisionObjects.map((decisionObject) => {
    const version = projectRepository.findDecisionObjectVersion(
      decisionObject.object_id,
      decisionObject.current_version
    );

    return toDecisionObjectSummary(decisionObject, version);
  });
}
