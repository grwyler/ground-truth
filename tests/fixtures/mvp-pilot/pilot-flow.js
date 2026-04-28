import assert from "node:assert/strict";
import { createApiServer } from "../../../apps/api/src/server.js";
import { createInMemoryProjectRepository } from "../../../packages/db/src/index.js";
import {
  DECISION_OBJECT_TYPES,
  READINESS_STATUSES,
  TRACE_RELATIONSHIP_TYPES
} from "../../../packages/domain/src/index.js";

export const PILOT_PROJECT_INPUT = Object.freeze({
  name: "MVP Pilot - Field Service Mobilization",
  description:
    "End-to-end pilot scenario for proving Ready-to-Build gating before Jira handoff.",
  customer: "Acme Federal Services",
  contractNumber: "GT-PILOT-2026-001",
  programName: "Apollo"
});

export const PILOT_SOURCE_DOCUMENTS = Object.freeze([
  Object.freeze({
    fileName: "apollo-field-service-sow.txt",
    documentType: "sow",
    content: [
      "Apollo field service teams must capture source-backed field intake records before build start.",
      "Operators need a workflow for assignment review, site evidence capture, and offline submission.",
      "The delivery team must preserve photo evidence, acceptance criteria, approvals, and traceability.",
      "Jira export may begin only after Ready-to-Build certification or explicit PM risk acceptance."
    ].join("\n")
  })
]);

export function createPilotRepository(seedData = {}) {
  return createInMemoryProjectRepository({
    projects: [],
    documents: [],
    aiGenerationJobs: [],
    decisionObjects: [],
    decisionObjectVersions: [],
    traceLinks: [],
    approvals: [],
    readinessEvaluations: [],
    blockers: [],
    overrides: [],
    certificationPackages: [],
    jiraExports: [],
    auditEvents: [],
    ...seedData
  });
}

export async function createPilotHarness() {
  const repository = createPilotRepository();
  const idGenerator = createPilotIdGenerator();
  const now = new Date("2026-04-28T12:00:00.000Z");
  const storageAdapter = Object.freeze({
    async putObject({ projectId, objectId, fileName }) {
      return {
        storageUri: `memory://${projectId}/${objectId}/${fileName}`
      };
    }
  });
  const server = await listen(
    createApiServer({
      projectRepository: repository,
      storageAdapter,
      idGenerator,
      now
    })
  );

  return Object.freeze({
    repository,
    server,
    baseUrl: getBaseUrl(server),
    async close() {
      server.close();
    }
  });
}

export async function runPilotHappyPath(baseUrl) {
  const project = await createPilotProject(baseUrl);
  await uploadPilotDocuments(baseUrl, project.projectId);
  const generated = await generatePilotDraft(baseUrl, project.projectId);
  const accepted = await acceptDraftsAndAssignOwners(
    baseUrl,
    project.projectId,
    generated.decisionObjects
  );

  const blockedExport = await postJson(
    baseUrl,
    `/api/v1/projects/${project.projectId}/integrations/jira/export`,
    "user-eng-001",
    {
      jiraProjectKey: "APOLLO",
      exportMode: "CreateEpicsAndStories",
      includeTraceabilityLinks: true
    }
  );
  assert.equal(blockedExport.status, 409);
  assert.equal(blockedExport.body.error, "PROJECT_NOT_READY");
  assert.ok(blockedExport.body.blockers.length >= 1);

  const systemApproval = await postJson(
    baseUrl,
    `/api/v1/projects/${project.projectId}/decision-objects/${accepted.requirement.objectId}/approvals`,
    "system-ai-assistant",
    {
      version: accepted.requirement.currentVersion,
      approvalDecision: "approved",
      comment: "System actor must not be allowed to approve."
    }
  );
  assert.equal(systemApproval.status, 403);

  await createTraceLink(
    baseUrl,
    project.projectId,
    accepted.requirement.objectId,
    accepted.workflow.objectId,
    TRACE_RELATIONSHIP_TYPES.DERIVED_FROM
  );
  await createTraceLink(
    baseUrl,
    project.projectId,
    accepted.requirement.objectId,
    accepted.testObject.objectId,
    TRACE_RELATIONSHIP_TYPES.VALIDATED_BY
  );

  await approveObject(baseUrl, project.projectId, accepted.workflow, "user-operator-001");
  await approveObject(baseUrl, project.projectId, accepted.requirement, "user-customer-pm-001");

  const startedAt = Date.now();
  const readiness = await getJson(
    baseUrl,
    `/api/v1/projects/${project.projectId}/readiness`,
    "user-exec-viewer-001"
  );
  const elapsedMs = Date.now() - startedAt;
  assert.equal(readiness.status, 200);
  assert.equal(readiness.body.readiness.status, READINESS_STATUSES.READY);
  assert.equal(readiness.body.readiness.readinessScore, 100);
  assert.deepEqual(readiness.body.readiness.hardBlockers, []);
  assert.ok(elapsedMs < 2000);

  const certification = await postJson(
    baseUrl,
    `/api/v1/projects/${project.projectId}/certification-package`,
    "user-pm-001",
    {
      includeTraceabilityMatrix: true,
      includeApprovals: true,
      includeRisks: true,
      includeOverrides: true
    }
  );
  assert.equal(certification.status, 201);
  assert.equal(certification.body.package.status, "generated");
  assert.ok(certification.body.package.artifact.traceabilityMatrix.length >= 2);

  const exportResult = await exportToJira(baseUrl, project.projectId);
  assert.equal(exportResult.status, 202);
  assert.equal(exportResult.body.exportJob.status, "completed");
  assert.equal(exportResult.body.exportJob.preview[0].sourceRequirementId, accepted.requirement.objectId);
  assert.equal(exportResult.body.exportJob.preview[0].workflowLink.objectId, accepted.workflow.objectId);
  assert.equal(
    exportResult.body.exportJob.preview[0].acceptanceCriteriaLink.objectId,
    accepted.testObject.objectId
  );
  assert.ok(
    exportResult.body.exportJob.preview[0].traceabilityMetadata.requiredLinkIds.length >= 2
  );

  return {
    project,
    accepted,
    readiness: readiness.body.readiness,
    certification: certification.body.package,
    exportJob: exportResult.body.exportJob
  };
}

export async function runPilotOverridePath(baseUrl) {
  const project = await createPilotProject(baseUrl);
  await uploadPilotDocuments(baseUrl, project.projectId);
  const generated = await generatePilotDraft(baseUrl, project.projectId);
  await acceptDraftsAndAssignOwners(baseUrl, project.projectId, generated.decisionObjects);

  const initialReadiness = await getJson(
    baseUrl,
    `/api/v1/projects/${project.projectId}/readiness`,
    "user-pm-001"
  );
  assert.equal(initialReadiness.status, 200);
  assert.equal(initialReadiness.body.readiness.status, READINESS_STATUSES.NOT_READY);
  assert.ok(initialReadiness.body.readiness.hardBlockers.length >= 1);

  const systemOverride = await postJson(
    baseUrl,
    `/api/v1/projects/${project.projectId}/overrides`,
    "system-ai-assistant",
    {
      blockerIds: initialReadiness.body.readiness.hardBlockers.map(
        (blocker) => blocker.blockerId
      ),
      reason: "System actor must not be allowed to accept risk.",
      riskAcknowledgment: "This should be rejected."
    }
  );
  assert.equal(systemOverride.status, 403);

  const override = await postJson(
    baseUrl,
    `/api/v1/projects/${project.projectId}/overrides`,
    "user-pm-001",
    {
      blockerIds: initialReadiness.body.readiness.hardBlockers.map(
        (blocker) => blocker.blockerId
      ),
      reason: "Pilot proceeds under PM-controlled risk acceptance for stakeholder walkthrough.",
      riskAcknowledgment:
        "The unresolved traceability and approval gaps remain visible and must be closed before production use."
    }
  );
  assert.equal(override.status, 201);
  assert.equal(override.body.readiness.status, READINESS_STATUSES.READY);
  assert.equal(
    override.body.override.blockerIds.length,
    initialReadiness.body.readiness.hardBlockers.length
  );
  assert.ok(override.body.readiness.resolvedBlockers.every((blocker) => blocker.status === "overridden"));
  assert.equal(override.body.readiness.overrides.length, 1);

  const certification = await postJson(
    baseUrl,
    `/api/v1/projects/${project.projectId}/certification-package`,
    "user-pm-001",
    {
      includeTraceabilityMatrix: true,
      includeApprovals: true,
      includeRisks: true,
      includeOverrides: true
    }
  );
  assert.equal(certification.status, 201);
  assert.equal(certification.body.package.artifact.overrides.length, 1);

  const exportResult = await exportToJira(baseUrl, project.projectId);
  assert.equal(exportResult.status, 202);
  assert.equal(exportResult.body.exportJob.status, "completed");

  return {
    project,
    override: override.body.override,
    readiness: override.body.readiness,
    certification: certification.body.package,
    exportJob: exportResult.body.exportJob
  };
}

async function createPilotProject(baseUrl) {
  const response = await postJson(baseUrl, "/api/v1/projects", "user-pm-001", PILOT_PROJECT_INPUT);

  assert.equal(response.status, 201);
  assert.equal(response.body.project.name, PILOT_PROJECT_INPUT.name);

  return response.body.project;
}

async function uploadPilotDocuments(baseUrl, projectId) {
  const response = await postJson(
    baseUrl,
    `/api/v1/projects/${projectId}/documents`,
    "user-pm-001",
    {
      documentType: PILOT_SOURCE_DOCUMENTS[0].documentType,
      files: PILOT_SOURCE_DOCUMENTS.map((document) => ({
        fileName: document.fileName,
        contentType: "text/plain",
        content: document.content
      }))
    }
  );

  assert.equal(response.status, 201);
  assert.equal(response.body.documents.length, PILOT_SOURCE_DOCUMENTS.length);
  assert.equal(response.body.canGenerateDraft, true);

  return response.body.documents;
}

async function generatePilotDraft(baseUrl, projectId) {
  const response = await postJson(
    baseUrl,
    `/api/v1/projects/${projectId}/ai/generate-draft`,
    "user-pm-001",
    {}
  );

  assert.equal(response.status, 201);
  assert.equal(response.body.job.status, "completed");
  assert.ok(response.body.decisionObjects.length >= 4);

  return response.body;
}

async function acceptDraftsAndAssignOwners(baseUrl, projectId, decisionObjects) {
  const accepted = [];

  for (const decisionObject of decisionObjects) {
    const acceptResponse = await postJson(
      baseUrl,
      `/api/v1/projects/${projectId}/decision-objects/${decisionObject.objectId}/accept`,
      "user-pm-001",
      {}
    );
    assert.equal(acceptResponse.status, 200);
    accepted.push(acceptResponse.body.decisionObject);
  }

  const workflow = accepted.find((object) => object.type === DECISION_OBJECT_TYPES.WORKFLOW);
  const requirement = accepted.find((object) => object.type === DECISION_OBJECT_TYPES.REQUIREMENT);
  const testObject = accepted.find((object) => object.type === DECISION_OBJECT_TYPES.TEST);
  const risk = accepted.find((object) => object.type === DECISION_OBJECT_TYPES.RISK);

  assert.ok(workflow);
  assert.ok(requirement);
  assert.ok(testObject);
  assert.ok(risk);

  return {
    workflow: await assignOwner(baseUrl, projectId, workflow, "user-operator-001"),
    requirement: await assignOwner(baseUrl, projectId, requirement, "user-eng-001"),
    testObject: await assignOwner(baseUrl, projectId, testObject, "user-eng-001"),
    risk: await assignOwner(baseUrl, projectId, risk, "user-pm-001")
  };
}

async function assignOwner(baseUrl, projectId, decisionObject, ownerId) {
  const response = await patchJson(
    baseUrl,
    `/api/v1/projects/${projectId}/decision-objects/${decisionObject.objectId}/owner`,
    "user-pm-001",
    { ownerId }
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.decisionObject.ownerId, ownerId);

  return response.body.decisionObject;
}

async function createTraceLink(baseUrl, projectId, sourceObjectId, targetObjectId, relationshipType) {
  const response = await postJson(
    baseUrl,
    `/api/v1/projects/${projectId}/decision-objects/${sourceObjectId}/links`,
    "user-eng-001",
    {
      targetObjectId,
      relationshipType
    }
  );

  assert.equal(response.status, 201);
  assert.equal(response.body.traceLink.targetObjectId, targetObjectId);

  return response.body.traceLink;
}

async function approveObject(baseUrl, projectId, decisionObject, actorId) {
  const response = await postJson(
    baseUrl,
    `/api/v1/projects/${projectId}/decision-objects/${decisionObject.objectId}/approvals`,
    actorId,
    {
      version: decisionObject.currentVersion,
      approvalDecision: "approved",
      comment: "Approved for MVP pilot readiness."
    }
  );

  assert.equal(response.status, 201);
  assert.equal(response.body.approval.approvalDecision, "approved");

  return response.body.approval;
}

async function exportToJira(baseUrl, projectId) {
  return postJson(
    baseUrl,
    `/api/v1/projects/${projectId}/integrations/jira/export`,
    "user-eng-001",
    {
      jiraProjectKey: "APOLLO",
      exportMode: "CreateEpicsAndStories",
      includeTraceabilityLinks: true
    }
  );
}

async function getJson(baseUrl, path, actorId) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "x-user-id": actorId }
  });

  return {
    status: response.status,
    body: await response.json()
  };
}

async function postJson(baseUrl, path, actorId, body) {
  return requestJson(baseUrl, path, actorId, "POST", body);
}

async function patchJson(baseUrl, path, actorId, body) {
  return requestJson(baseUrl, path, actorId, "PATCH", body);
}

async function requestJson(baseUrl, path, actorId, method, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-user-id": actorId
    },
    body: JSON.stringify(body)
  });

  return {
    status: response.status,
    body: await response.json()
  };
}

function createPilotIdGenerator() {
  let counter = 0;

  return (prefix = "id") => {
    counter += 1;
    return `${prefix}-pilot-${String(counter).padStart(3, "0")}`;
  };
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
