import test from "node:test";
import assert from "node:assert/strict";
import { createApiServer } from "../../../apps/api/src/server.js";
import { createInMemoryProjectRepository } from "../../../packages/db/src/index.js";

test("project API creates, lists, and reads projects for authorized PM users", async () => {
  const repository = createInMemoryProjectRepository({
    projects: [],
    auditEvents: []
  });
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const createResponse = await fetch(`${baseUrl}/api/v1/projects`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        name: "Project Intake Demo",
        customer: "Acme Federal Services",
        contractNumber: "GT-004",
        programName: "Apollo"
      })
    });
    const created = await createResponse.json();

    assert.equal(createResponse.status, 201);
    assert.equal(created.project.name, "Project Intake Demo");
    assert.equal(created.project.status, "draft");
    assert.equal(created.project.readinessStatus, "not_ready");

    const listResponse = await fetch(`${baseUrl}/api/v1/projects`);
    const listed = await listResponse.json();

    assert.equal(listResponse.status, 200);
    assert.equal(listed.projects.length, 1);
    assert.equal(listed.projects[0].projectId, created.project.projectId);

    const readResponse = await fetch(
      `${baseUrl}/api/v1/projects/${created.project.projectId}`
    );
    const read = await readResponse.json();

    assert.equal(readResponse.status, 200);
    assert.equal(read.project.projectId, created.project.projectId);
    assert.equal(repository.listAuditEvents(created.project.projectId).length, 1);
  } finally {
    server.close();
  }
});

test("project API rejects missing names and unauthorized creation", async () => {
  const repository = createInMemoryProjectRepository({
    projects: [],
    auditEvents: []
  });
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const validationResponse = await fetch(`${baseUrl}/api/v1/projects`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ name: " " })
    });
    const validationBody = await validationResponse.json();

    assert.equal(validationResponse.status, 400);
    assert.equal(validationBody.error, "VALIDATION_ERROR");

    const unauthorizedResponse = await fetch(`${baseUrl}/api/v1/projects`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-id": "user-exec-viewer-001"
      },
      body: JSON.stringify({ name: "Executive Cannot Create" })
    });
    const unauthorizedBody = await unauthorizedResponse.json();

    assert.equal(unauthorizedResponse.status, 403);
    assert.equal(unauthorizedBody.error, "FORBIDDEN");
    assert.equal(repository.listProjects().length, 0);
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
