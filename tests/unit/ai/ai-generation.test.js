import test from "node:test";
import assert from "node:assert/strict";
import { createDeterministicDraftAdapter } from "../../../packages/ai/src/index.js";
import {
  AI_JOB_STATUSES,
  AI_SYSTEM_ACTOR,
  DECISION_OBJECT_STATUSES,
  DECISION_OBJECT_TYPES,
  SEEDED_MVP_USERS,
  buildQueuedAiGenerationJob,
  markAiGenerationJobCompleted,
  markAiGenerationJobRunning,
  normalizeAiDraftOutput
} from "../../../packages/domain/src/index.js";
import { createLocalAiGenerationService } from "../../../apps/web/src/main.js";

const pm = SEEDED_MVP_USERS[0];
const project = {
  project_id: "project-ai",
  name: "AI Draft Project",
  description: null,
  customer: null,
  contract_number: null,
  program_name: null,
  status: "draft",
  readiness_status: "not_ready",
  readiness_score: 0,
  created_by: pm.id,
  created_at: "2026-04-28T12:00:00.000Z",
  updated_at: "2026-04-28T12:00:00.000Z"
};
const documents = [
  {
    document_id: "doc-ai-1",
    project_id: "project-ai",
    file_name: "source.txt",
    document_type: "sow",
    storage_uri: "local://source.txt",
    upload_status: "uploaded",
    uploaded_by: pm.id,
    uploaded_at: "2026-04-28T12:00:00.000Z",
    extracted_text_uri: null,
    checksum: "sha256:source"
  }
];

test("AI generation builds a queued job and deterministic draft objects", async () => {
  const queued = buildQueuedAiGenerationJob(
    {
      projectId: project.project_id,
      documents
    },
    pm,
    {
      now: new Date("2026-04-28T13:00:00.000Z"),
      idGenerator: () => "ai-job-test"
    }
  );

  assert.equal(queued.ok, true);
  assert.equal(queued.job.status, AI_JOB_STATUSES.QUEUED);
  assert.deepEqual(queued.job.document_ids, ["doc-ai-1"]);

  const adapter = createDeterministicDraftAdapter();
  const output = await adapter.generateDraft({ project, documents });
  const running = markAiGenerationJobRunning(queued.job);
  let sequence = 0;
  const normalized = normalizeAiDraftOutput(output, running, AI_SYSTEM_ACTOR, {
    now: new Date("2026-04-28T13:01:00.000Z"),
    idGenerator: () => {
      sequence += 1;
      return `generated-${sequence}`;
    }
  });

  assert.equal(normalized.ok, true);
  assert.equal(normalized.decisionObjects.length, 4);
  assert.ok(
    normalized.decisionObjects.some(
      (decisionObject) => decisionObject.type === DECISION_OBJECT_TYPES.REQUIREMENT
    )
  );
  assert.ok(
    normalized.decisionObjects.every(
      (decisionObject) => decisionObject.status === DECISION_OBJECT_STATUSES.DRAFT
    )
  );
  assert.ok(
    normalized.decisionObjects.every(
      (decisionObject) =>
        decisionObject.created_by === AI_SYSTEM_ACTOR.id && decisionObject.owner_id === null
    )
  );
  assert.ok(
    normalized.decisionObjectVersions.every(
      (version) =>
        version.changed_by === AI_SYSTEM_ACTOR.id &&
        version.content.ai_generated === true &&
        version.content.source_document_ids.includes("doc-ai-1")
    )
  );

  const completed = markAiGenerationJobCompleted(running, {
    now: new Date("2026-04-28T13:02:00.000Z")
  });

  assert.equal(completed.status, AI_JOB_STATUSES.COMPLETED);
  assert.equal(completed.completed_at, "2026-04-28T13:02:00.000Z");
});

test("AI generation validation requires uploaded documents", () => {
  const result = buildQueuedAiGenerationJob(
    {
      projectId: project.project_id,
      documents: []
    },
    pm
  );

  assert.equal(result.ok, false);
});

test("local AI generation service returns actionable failure without deleting documents", async () => {
  const projectService = {
    listProjects() {
      return [
        {
          projectId: "project-ai",
          name: "AI Draft Project",
          status: "draft",
          readinessStatus: "not_ready",
          readinessScore: 0,
          createdBy: pm.id,
          createdAt: "2026-04-28T12:00:00.000Z",
          updatedAt: "2026-04-28T12:00:00.000Z"
        }
      ];
    }
  };
  const documentService = {
    listDocuments() {
      return [
        {
          documentId: "doc-ai-1",
          projectId: "project-ai",
          fileName: "source.txt",
          documentType: "sow",
          storageUri: "local://source.txt",
          uploadStatus: "uploaded",
          uploadedBy: pm.id,
          uploadedAt: "2026-04-28T12:00:00.000Z",
          extractedTextUri: null,
          checksum: "sha256:source"
        }
      ];
    }
  };
  const service = createLocalAiGenerationService(
    projectService,
    documentService,
    createDeterministicDraftAdapter({ shouldFail: true })
  );
  const result = await service.generateDraft("project-ai", pm);

  assert.equal(result.ok, false);
  assert.equal(result.job.status, AI_JOB_STATUSES.FAILED);
  assert.equal(documentService.listDocuments("project-ai").length, 1);
});
