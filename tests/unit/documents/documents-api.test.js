import test from "node:test";
import assert from "node:assert/strict";
import { createApiServer } from "../../../apps/api/src/server.js";
import { createInMemoryProjectRepository } from "../../../packages/db/src/index.js";

const project = {
  project_id: "project-docs",
  name: "Document Project",
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

test("document API uploads multiple supported files and returns persisted inventory", async () => {
  const repository = createInMemoryProjectRepository({
    projects: [project],
    documents: [],
    auditEvents: []
  });
  const server = await listen(
    createApiServer({
      projectRepository: repository,
      storageAdapter: createMemoryStorageAdapter()
    })
  );
  const baseUrl = getBaseUrl(server);

  try {
    const body = new FormData();
    body.append("documents", new Blob(["SOW text"], { type: "text/plain" }), "apollo-sow.txt");
    body.append(
      "documents",
      new Blob(["Operator notes"], { type: "text/plain" }),
      "operator-notes.txt"
    );

    const uploadResponse = await fetch(
      `${baseUrl}/api/v1/projects/project-docs/documents`,
      {
        method: "POST",
        body
      }
    );
    const upload = await uploadResponse.json();

    assert.equal(uploadResponse.status, 201);
    assert.equal(upload.documents.length, 2);
    assert.equal(upload.inventory.length, 2);
    assert.equal(upload.canGenerateDraft, true);
    assert.equal(repository.listDocuments("project-docs").length, 2);
    assert.equal(repository.listAuditEvents("project-docs").length, 2);

    const listResponse = await fetch(`${baseUrl}/api/v1/projects/project-docs/documents`);
    const list = await listResponse.json();

    assert.equal(listResponse.status, 200);
    assert.equal(list.documents.length, 2);
    assert.equal(list.canGenerateDraft, true);
  } finally {
    server.close();
  }
});

test("document API rejects unsupported file types without deleting existing documents", async () => {
  const repository = createInMemoryProjectRepository({
    projects: [project],
    documents: [
      {
        document_id: "doc-existing",
        project_id: "project-docs",
        file_name: "existing.txt",
        document_type: "notes",
        storage_uri: "local://existing.txt",
        upload_status: "uploaded",
        uploaded_by: "user-pm-001",
        uploaded_at: "2026-04-28T12:00:00.000Z",
        extracted_text_uri: null,
        checksum: "sha256:existing"
      }
    ],
    auditEvents: []
  });
  const server = await listen(
    createApiServer({
      projectRepository: repository,
      storageAdapter: createMemoryStorageAdapter()
    })
  );
  const baseUrl = getBaseUrl(server);

  try {
    const body = new FormData();
    body.append(
      "documents",
      new Blob(["spreadsheet"], { type: "application/octet-stream" }),
      "bad.xlsx"
    );

    const response = await fetch(`${baseUrl}/api/v1/projects/project-docs/documents`, {
      method: "POST",
      body
    });
    const result = await response.json();

    assert.equal(response.status, 400);
    assert.equal(result.error, "VALIDATION_ERROR");
    assert.equal(repository.listDocuments("project-docs").length, 1);
  } finally {
    server.close();
  }
});

test("document API blocks unauthorized uploads", async () => {
  const repository = createInMemoryProjectRepository({
    projects: [project],
    documents: [],
    auditEvents: []
  });
  const server = await listen(
    createApiServer({
      projectRepository: repository,
      storageAdapter: createMemoryStorageAdapter()
    })
  );
  const baseUrl = getBaseUrl(server);

  try {
    const body = new FormData();
    body.append("documents", new Blob(["notes"], { type: "text/plain" }), "notes.txt");

    const response = await fetch(`${baseUrl}/api/v1/projects/project-docs/documents`, {
      method: "POST",
      headers: {
        "x-user-id": "user-exec-viewer-001"
      },
      body
    });
    const result = await response.json();

    assert.equal(response.status, 403);
    assert.equal(result.error, "FORBIDDEN");
    assert.equal(repository.listDocuments("project-docs").length, 0);
  } finally {
    server.close();
  }
});

function createMemoryStorageAdapter() {
  return Object.freeze({
    async putObject({ projectId, objectId, fileName }) {
      return {
        storageUri: `memory://${projectId}/${objectId}/${fileName}`
      };
    }
  });
}

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
