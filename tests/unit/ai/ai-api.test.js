import test from "node:test";
import assert from "node:assert/strict";
import { createApiServer } from "../../../apps/api/src/server.js";
import { createInMemoryProjectRepository } from "../../../packages/db/src/index.js";
import { AI_JOB_STATUSES, AI_SYSTEM_ACTOR } from "../../../packages/domain/src/index.js";
import { createDeterministicDraftAdapter } from "../../../packages/ai/src/index.js";

const project = {
  project_id: "project-ai-api",
  name: "AI API Project",
  description: null,
  customer: null,
  contract_number: null,
  program_name: null,
  status: "draft",
  readiness_status: "not_ready",
  readiness_score: 0,
  created_by: "user-pm-001",
  created_at: "2026-04-28T12:00:00.000Z",
  updated_at: "2026-04-28T12:00:00.000Z"
};
const documentRecord = {
  document_id: "doc-api-1",
  project_id: "project-ai-api",
  file_name: "api-source.txt",
  document_type: "sow",
  storage_uri: "local://api-source.txt",
  upload_status: "uploaded",
  uploaded_by: "user-pm-001",
  uploaded_at: "2026-04-28T12:00:00.000Z",
  extracted_text_uri: null,
  checksum: "sha256:api-source"
};

test("AI API generates draft objects and exposes completed job status", async () => {
  const repository = createInMemoryProjectRepository({
    projects: [project],
    documents: [documentRecord],
    aiGenerationJobs: [],
    decisionObjects: [],
    decisionObjectVersions: [],
    auditEvents: []
  });
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const generateResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-ai-api/ai/generate-draft`,
      {
        method: "POST"
      }
    );
    const generated = await generateResponse.json();

    assert.equal(generateResponse.status, 201);
    assert.equal(generated.job.status, AI_JOB_STATUSES.COMPLETED);
    assert.ok(generated.decisionObjects.length >= 6);
    assert.ok(
      generated.decisionObjects.every(
        (decisionObject) =>
          decisionObject.status === "draft" &&
          decisionObject.createdBy === AI_SYSTEM_ACTOR.id &&
          decisionObject.ownerId === null
      )
    );
    assert.equal(repository.listAiGenerationJobs("project-ai-api").length, 1);
    assert.ok(repository.listDecisionObjects("project-ai-api").length >= 6);
    assert.equal(repository.listAuditEvents("project-ai-api").length, 1);

    const statusResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-ai-api/ai/generation-jobs/${generated.job.generationJobId}`
    );
    const status = await statusResponse.json();

    assert.equal(statusResponse.status, 200);
    assert.equal(status.job.status, AI_JOB_STATUSES.COMPLETED);
  } finally {
    server.close();
  }
});

test("AI API blocks generation without documents and for unauthorized users", async () => {
  const repository = createInMemoryProjectRepository({
    projects: [project],
    documents: [],
    aiGenerationJobs: [],
    decisionObjects: [],
    decisionObjectVersions: [],
    auditEvents: []
  });
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const validationResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-ai-api/ai/generate-draft`,
      {
        method: "POST"
      }
    );
    const validation = await validationResponse.json();

    assert.equal(validationResponse.status, 400);
    assert.equal(validation.error, "VALIDATION_ERROR");

    const unauthorizedResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-ai-api/ai/generate-draft`,
      {
        method: "POST",
        headers: {
          "x-user-id": "user-exec-viewer-001"
        }
      }
    );
    const unauthorized = await unauthorizedResponse.json();

    assert.equal(unauthorizedResponse.status, 403);
    assert.equal(unauthorized.error, "FORBIDDEN");
  } finally {
    server.close();
  }
});

test("AI API records failed jobs without removing uploaded documents", async () => {
  const repository = createInMemoryProjectRepository({
    projects: [project],
    documents: [documentRecord],
    aiGenerationJobs: [],
    decisionObjects: [],
    decisionObjectVersions: [],
    auditEvents: []
  });
  const server = await listen(
    createApiServer({
      projectRepository: repository,
      aiDraftAdapter: createDeterministicDraftAdapter({ shouldFail: true })
    })
  );
  const baseUrl = getBaseUrl(server);

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/projects/project-ai-api/ai/generate-draft`,
      {
        method: "POST"
      }
    );
    const result = await response.json();

    assert.equal(response.status, 500);
    assert.equal(result.job.status, AI_JOB_STATUSES.FAILED);
    assert.equal(repository.listDocuments("project-ai-api").length, 1);
    assert.equal(repository.listDecisionObjects("project-ai-api").length, 0);
    assert.equal(repository.listAiGenerationJobs("project-ai-api").length, 1);
  } finally {
    server.close();
  }
});

function listen(server) {
  return new Promise((resolve, reject) => {
    server.listen(0, () => resolve(server));
    server.on("error", reject);
  });
}

function getBaseUrl(server) {
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}
