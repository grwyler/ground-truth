import test from "node:test";
import assert from "node:assert/strict";
import { createApiServer } from "../../../apps/api/src/server.js";
import { createInMemoryProjectRepository } from "../../../packages/db/src/index.js";
import {
  APPROVAL_DECISIONS,
  APPROVAL_STATUSES,
  AUDIT_EVENT_TYPES,
  DECISION_OBJECT_TYPES,
  TRACE_RELATIONSHIP_TYPES
} from "../../../packages/domain/src/index.js";

test("audit API exposes project audit feed to PM and Executive Viewer", async () => {
  const repository = createRepository({
    auditEvents: [
      auditEvent("audit-older", AUDIT_EVENT_TYPES.CREATE, "project", project.project_id, {
        name: project.name
      }),
      auditEvent("audit-newer", AUDIT_EVENT_TYPES.EXPORT, "jira_export", "export-1", {
        status: "completed"
      })
    ]
  });
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const pmResponse = await fetch(`${baseUrl}/api/v1/projects/project-audit-api/audit`, {
      headers: { "x-user-id": "user-pm-001" }
    });
    const pmBody = await pmResponse.json();
    const executiveResponse = await fetch(`${baseUrl}/api/v1/projects/project-audit-api/audit`, {
      headers: { "x-user-id": "user-exec-viewer-001" }
    });

    assert.equal(pmResponse.status, 200);
    assert.deepEqual(
      pmBody.auditEvents.map((event) => event.auditEventId),
      ["audit-older", "audit-newer"]
    );
    assert.equal(pmBody.auditEvents[1].eventType, AUDIT_EVENT_TYPES.EXPORT);
    assert.equal(executiveResponse.status, 200);
  } finally {
    server.close();
  }
});

test("audit API rejects actors without project read permission", async () => {
  const repository = createRepository();
  const server = await listen(createApiServer({ projectRepository: repository }));
  const baseUrl = getBaseUrl(server);

  try {
    const response = await fetch(`${baseUrl}/api/v1/projects/project-audit-api/audit`, {
      headers: { "x-user-id": "system-ai-assistant" }
    });

    assert.equal(response.status, 403);
  } finally {
    server.close();
  }
});

test("approval action fails closed when audit event creation fails", async () => {
  const workflow = decisionObject("obj-workflow-audit", DECISION_OBJECT_TYPES.WORKFLOW);
  const repository = createRepository({
    decisionObjects: [workflow],
    decisionObjectVersions: [versionFor(workflow)]
  });
  const server = await listen(
    createApiServer({
      projectRepository: repository,
      idGenerator: auditFailingIdGenerator()
    })
  );
  const baseUrl = getBaseUrl(server);

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/projects/project-audit-api/decision-objects/obj-workflow-audit/approvals`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id": "user-operator-001"
        },
        body: JSON.stringify({
          version: 1,
          approvalDecision: "approved",
          comment: "Operationally approved."
        })
      }
    );
    const body = await response.json();

    assert.equal(response.status, 500);
    assert.equal(body.error, "AUDIT_WRITE_FAILED");
    assert.equal(repository.listProjectApprovals(project.project_id).length, 0);
  } finally {
    server.close();
  }
});

test("override action fails closed when audit event creation fails", async () => {
  const requirement = decisionObject("obj-req-audit", DECISION_OBJECT_TYPES.REQUIREMENT);
  const requirementVersion = versionFor(requirement);
  const repository = createRepository({
    decisionObjects: [requirement],
    decisionObjectVersions: [requirementVersion],
    approvals: [approvalFor(requirement, requirementVersion)]
  });
  const server = await listen(
    createApiServer({
      projectRepository: repository,
      idGenerator: auditFailingIdGenerator()
    })
  );
  const baseUrl = getBaseUrl(server);

  try {
    const response = await fetch(`${baseUrl}/api/v1/projects/project-audit-api/overrides`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-id": "user-pm-001"
      },
      body: JSON.stringify({
        blockerIds: [
          "blocker-project-audit-api-obj-req-audit-missing-workflow-link",
          "blocker-project-audit-api-obj-req-audit-missing-acceptance-criteria"
        ],
        reason: "Accept traceability risk for a pilot.",
        riskAcknowledgment: "PM accepts the named traceability risk."
      })
    });
    const body = await response.json();

    assert.equal(response.status, 500);
    assert.equal(body.error, "AUDIT_WRITE_FAILED");
    assert.equal(repository.listProjectOverrides(project.project_id).length, 0);
  } finally {
    server.close();
  }
});

test("Jira export action fails closed when export audit event creation fails", async () => {
  const records = buildReadyRecords();
  const repository = createRepository(records);
  const server = await listen(
    createApiServer({
      projectRepository: repository,
      idGenerator: exportAuditFailingIdGenerator()
    })
  );
  const baseUrl = getBaseUrl(server);

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/projects/project-audit-api/integrations/jira/export`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id": "user-eng-001"
        },
        body: JSON.stringify({
          jiraProjectKey: "GT",
          exportMode: "CreateEpicsAndStories",
          includeTraceabilityLinks: true
        })
      }
    );
    const body = await response.json();

    assert.equal(response.status, 500);
    assert.equal(body.error, "AUDIT_WRITE_FAILED");
    assert.equal(repository.listJiraExports(project.project_id).length, 0);
  } finally {
    server.close();
  }
});

const project = {
  project_id: "project-audit-api",
  name: "Audit API Project",
  description: null,
  customer: null,
  contract_number: null,
  program_name: null,
  status: "not_ready",
  readiness_status: "not_ready",
  readiness_score: 0,
  created_by: "user-pm-001",
  created_at: "2026-04-28T12:00:00.000Z",
  updated_at: "2026-04-28T12:00:00.000Z"
};

function createRepository({
  decisionObjects = [],
  decisionObjectVersions = [],
  traceLinks = [],
  approvals = [],
  auditEvents = []
} = {}) {
  return createInMemoryProjectRepository({
    projects: [project],
    documents: [],
    aiGenerationJobs: [],
    decisionObjects,
    decisionObjectVersions,
    traceLinks,
    approvals,
    readinessEvaluations: [],
    blockers: [],
    overrides: [],
    certificationPackages: [],
    jiraExports: [],
    auditEvents
  });
}

function buildReadyRecords() {
  const workflow = decisionObject("obj-workflow-jira-audit", DECISION_OBJECT_TYPES.WORKFLOW);
  const requirement = decisionObject("obj-req-jira-audit", DECISION_OBJECT_TYPES.REQUIREMENT);
  const testObject = decisionObject("obj-test-jira-audit", DECISION_OBJECT_TYPES.TEST);
  const workflowVersion = versionFor(workflow);
  const requirementVersion = versionFor(requirement, {
    requirement: "The system shall export audited Jira stories.",
    acceptance_criteria: ["Traceability metadata is included."]
  });
  const testVersion = versionFor(testObject);

  return {
    decisionObjects: [workflow, requirement, testObject],
    decisionObjectVersions: [workflowVersion, requirementVersion, testVersion],
    traceLinks: [
      traceLink(requirement, workflow, TRACE_RELATIONSHIP_TYPES.DERIVED_FROM),
      traceLink(requirement, testObject, TRACE_RELATIONSHIP_TYPES.VALIDATED_BY)
    ],
    approvals: [
      approvalFor(workflow, workflowVersion),
      approvalFor(requirement, requirementVersion)
    ]
  };
}

function decisionObject(objectId, type) {
  return {
    object_id: objectId,
    project_id: project.project_id,
    type,
    title: objectId,
    current_version: 1,
    status: "in_review",
    owner_id: "user-eng-001",
    priority: "high",
    created_by: "user-pm-001",
    created_at: "2026-04-28T12:00:00.000Z",
    updated_at: "2026-04-28T12:00:00.000Z"
  };
}

function versionFor(decisionObjectRecord, content = {}) {
  return {
    version_id: `ver-${decisionObjectRecord.object_id}`,
    object_id: decisionObjectRecord.object_id,
    version_number: 1,
    content,
    change_reason: "Ready for audit test.",
    changed_by: "user-eng-001",
    created_at: "2026-04-28T12:00:00.000Z",
    meaningful_change: true
  };
}

function traceLink(sourceObject, targetObject, relationshipType) {
  return {
    link_id: `link-${sourceObject.object_id}-${targetObject.object_id}`,
    project_id: project.project_id,
    source_object_id: sourceObject.object_id,
    target_object_id: targetObject.object_id,
    relationship_type: relationshipType,
    required_for_readiness: true,
    created_by: "user-eng-001",
    created_at: "2026-04-28T12:00:00.000Z"
  };
}

function approvalFor(decisionObjectRecord, version) {
  return {
    approval_id: `approval-${decisionObjectRecord.object_id}`,
    object_id: decisionObjectRecord.object_id,
    version_id: version.version_id,
    approver_id: "user-customer-pm-001",
    decision: APPROVAL_DECISIONS.APPROVED,
    comment: "Approved.",
    status: APPROVAL_STATUSES.ACTIVE,
    created_at: "2026-04-28T12:00:00.000Z",
    invalidated_at: null,
    invalidation_reason: null
  };
}

function auditEvent(auditEventId, eventType, entityType, entityId, details) {
  return {
    audit_event_id: auditEventId,
    project_id: project.project_id,
    actor_id: "user-pm-001",
    event_type: eventType,
    entity_type: entityType,
    entity_id: entityId,
    timestamp:
      auditEventId === "audit-older"
        ? "2026-04-28T12:00:00.000Z"
        : "2026-04-28T13:00:00.000Z",
    details,
    immutable_hash: null
  };
}

function auditFailingIdGenerator() {
  let sequence = 0;

  return (kind) => {
    if (kind === "audit") {
      throw new Error("audit unavailable");
    }

    sequence += 1;
    return `${kind}-${sequence}`;
  };
}

function exportAuditFailingIdGenerator() {
  let sequence = 0;
  let auditSequence = 0;

  return (kind) => {
    if (kind === "audit") {
      auditSequence += 1;

      if (auditSequence === 2) {
        throw new Error("export audit unavailable");
      }
    }

    sequence += 1;
    return `${kind}-${sequence}`;
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
