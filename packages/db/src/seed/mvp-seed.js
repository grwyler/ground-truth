import {
  AI_SYSTEM_ACTOR,
  MVP_ROLES,
  SEEDED_MVP_USERS
} from "../../../domain/src/index.js";
import {
  AI_JOB_STATUSES,
  APPROVAL_DECISIONS,
  APPROVAL_STATUSES,
  AUDIT_EVENT_TYPES,
  BLOCKER_SEVERITIES,
  BLOCKER_STATUSES,
  BLOCKER_TYPES,
  CERTIFICATION_PACKAGE_STATUSES,
  DECISION_OBJECT_STATUSES,
  DECISION_OBJECT_TYPES,
  DOCUMENT_TYPES,
  DOCUMENT_UPLOAD_STATUSES,
  JIRA_EXPORT_STATUSES,
  OVERRIDE_VISIBILITIES,
  PRIORITIES,
  PROJECT_STATUSES,
  READINESS_STATUSES,
  ROLE_ASSIGNMENT_SCOPES,
  TRACE_RELATIONSHIP_TYPES,
  USER_STATUSES
} from "../../../domain/src/models/index.js";
import { getRequiredColumns } from "../schema/mvp-schema.js";

export const SEED_PROJECT_ID = "seed-project";
export const SEED_ORGANIZATION_ID = "org-ground-truth-demo";
export const SEED_TIMESTAMP = "2026-04-28T12:00:00.000Z";

function deepFreeze(value) {
  if (!value || typeof value !== "object") {
    return value;
  }

  for (const childValue of Object.values(value)) {
    deepFreeze(childValue);
  }

  return Object.freeze(value);
}

function toUserRecord(actor) {
  return {
    user_id: actor.id,
    external_identity_id: `local:${actor.id}`,
    name: actor.displayName,
    email: actor.email ?? `${actor.id}@system.local`,
    organization_id: SEED_ORGANIZATION_ID,
    status: USER_STATUSES.ACTIVE,
    created_at: SEED_TIMESTAMP
  };
}

export function createMvpSeedData() {
  const programManager = SEEDED_MVP_USERS.find(
    (user) => user.role === MVP_ROLES.PROGRAM_MANAGER
  );
  const engineeringLead = SEEDED_MVP_USERS.find(
    (user) => user.role === MVP_ROLES.ENGINEERING_LEAD
  );
  const operatorRepresentative = SEEDED_MVP_USERS.find(
    (user) => user.role === MVP_ROLES.OPERATOR_REPRESENTATIVE
  );
  const customerPm = SEEDED_MVP_USERS.find((user) => user.role === MVP_ROLES.CUSTOMER_PM);

  const projects = [
    {
      project_id: SEED_PROJECT_ID,
      name: "Apollo Field Service Mobilization",
      description:
        "Pilot readiness project for converting contract source material into build-ready requirements.",
      customer: "Acme Federal Services",
      contract_number: "GT-MVP-2026-001",
      program_name: "Apollo",
      status: PROJECT_STATUSES.NOT_READY,
      readiness_status: READINESS_STATUSES.NOT_READY,
      readiness_score: 62,
      created_by: programManager.id,
      created_at: SEED_TIMESTAMP,
      updated_at: SEED_TIMESTAMP
    }
  ];

  const documents = [
    {
      document_id: "doc-sow-001",
      project_id: SEED_PROJECT_ID,
      file_name: "apollo-sow.txt",
      document_type: DOCUMENT_TYPES.SOW,
      storage_uri: "local://seed/apollo-sow.txt",
      upload_status: DOCUMENT_UPLOAD_STATUSES.PARSED,
      uploaded_by: programManager.id,
      uploaded_at: SEED_TIMESTAMP,
      extracted_text_uri: "local://seed/apollo-sow.extracted.txt",
      checksum: "sha256:seed-sow-001"
    },
    {
      document_id: "doc-notes-001",
      project_id: SEED_PROJECT_ID,
      file_name: "operator-notes.txt",
      document_type: DOCUMENT_TYPES.NOTES,
      storage_uri: "local://seed/operator-notes.txt",
      upload_status: DOCUMENT_UPLOAD_STATUSES.UPLOADED,
      uploaded_by: operatorRepresentative.id,
      uploaded_at: SEED_TIMESTAMP,
      extracted_text_uri: null,
      checksum: "sha256:seed-notes-001"
    }
  ];

  const aiGenerationJobs = [
    {
      generation_job_id: "ai-job-001",
      project_id: SEED_PROJECT_ID,
      document_ids: documents.map((document) => document.document_id),
      status: AI_JOB_STATUSES.COMPLETED,
      generation_scope: ["workflows", "requirements", "tests", "risks"],
      ai_schema_version: "mvp-draft-v1",
      created_by: programManager.id,
      created_at: SEED_TIMESTAMP,
      completed_at: SEED_TIMESTAMP,
      error_message: null
    }
  ];

  const decisionObjects = [
    {
      object_id: "obj-workflow-field-intake",
      project_id: SEED_PROJECT_ID,
      type: DECISION_OBJECT_TYPES.WORKFLOW,
      title: "Field intake workflow",
      current_version: 1,
      status: DECISION_OBJECT_STATUSES.APPROVED,
      owner_id: operatorRepresentative.id,
      priority: PRIORITIES.HIGH,
      created_by: AI_SYSTEM_ACTOR.id,
      created_at: SEED_TIMESTAMP,
      updated_at: SEED_TIMESTAMP
    },
    {
      object_id: "obj-req-photo-evidence",
      project_id: SEED_PROJECT_ID,
      type: DECISION_OBJECT_TYPES.REQUIREMENT,
      title: "Capture photo evidence during field intake",
      current_version: 1,
      status: DECISION_OBJECT_STATUSES.IN_REVIEW,
      owner_id: engineeringLead.id,
      priority: PRIORITIES.CRITICAL,
      created_by: AI_SYSTEM_ACTOR.id,
      created_at: SEED_TIMESTAMP,
      updated_at: SEED_TIMESTAMP
    },
    {
      object_id: "obj-test-photo-evidence",
      project_id: SEED_PROJECT_ID,
      type: DECISION_OBJECT_TYPES.TEST,
      title: "Photo evidence acceptance criteria",
      current_version: 1,
      status: DECISION_OBJECT_STATUSES.DRAFT,
      owner_id: engineeringLead.id,
      priority: PRIORITIES.HIGH,
      created_by: AI_SYSTEM_ACTOR.id,
      created_at: SEED_TIMESTAMP,
      updated_at: SEED_TIMESTAMP
    },
    {
      object_id: "obj-req-offline-sync",
      project_id: SEED_PROJECT_ID,
      type: DECISION_OBJECT_TYPES.REQUIREMENT,
      title: "Synchronize intake records after offline work",
      current_version: 1,
      status: DECISION_OBJECT_STATUSES.DRAFT,
      owner_id: engineeringLead.id,
      priority: PRIORITIES.HIGH,
      created_by: AI_SYSTEM_ACTOR.id,
      created_at: SEED_TIMESTAMP,
      updated_at: SEED_TIMESTAMP
    },
    {
      object_id: "obj-risk-cellular-coverage",
      project_id: SEED_PROJECT_ID,
      type: DECISION_OBJECT_TYPES.RISK,
      title: "Remote sites may lack cellular coverage",
      current_version: 1,
      status: DECISION_OBJECT_STATUSES.IN_REVIEW,
      owner_id: programManager.id,
      priority: PRIORITIES.HIGH,
      created_by: programManager.id,
      created_at: SEED_TIMESTAMP,
      updated_at: SEED_TIMESTAMP
    }
  ];

  const decisionObjectVersions = [
    {
      version_id: "ver-workflow-field-intake-001",
      object_id: "obj-workflow-field-intake",
      version_number: 1,
      content: {
        summary: "Operator receives a field assignment, records site facts, and submits intake.",
        source_document_ids: ["doc-sow-001"]
      },
      change_reason: "Initial AI-generated workflow reviewed by operator representative.",
      changed_by: operatorRepresentative.id,
      created_at: SEED_TIMESTAMP,
      meaningful_change: true
    },
    {
      version_id: "ver-req-photo-evidence-001",
      object_id: "obj-req-photo-evidence",
      version_number: 1,
      content: {
        requirement:
          "The mobile workflow must require at least one timestamped photo before intake submission.",
        acceptance_criteria: ["Photo is timestamped", "Photo remains linked to the intake record"],
        source_document_ids: ["doc-sow-001"]
      },
      change_reason: "Initial AI draft normalized into a requirement.",
      changed_by: AI_SYSTEM_ACTOR.id,
      created_at: SEED_TIMESTAMP,
      meaningful_change: true
    },
    {
      version_id: "ver-test-photo-evidence-001",
      object_id: "obj-test-photo-evidence",
      version_number: 1,
      content: {
        acceptance_criteria: [
          "Given a field intake, when a photo is attached, then the submitted record includes photo metadata."
        ],
        source_document_ids: ["doc-sow-001"]
      },
      change_reason: "Initial test candidate generated from the photo evidence requirement.",
      changed_by: AI_SYSTEM_ACTOR.id,
      created_at: SEED_TIMESTAMP,
      meaningful_change: true
    },
    {
      version_id: "ver-req-offline-sync-001",
      object_id: "obj-req-offline-sync",
      version_number: 1,
      content: {
        requirement:
          "The application must preserve intake records locally and synchronize them when connectivity returns.",
        acceptance_criteria: [],
        source_document_ids: ["doc-notes-001"]
      },
      change_reason: "Initial AI draft flagged as missing acceptance criteria.",
      changed_by: AI_SYSTEM_ACTOR.id,
      created_at: SEED_TIMESTAMP,
      meaningful_change: true
    },
    {
      version_id: "ver-risk-cellular-coverage-001",
      object_id: "obj-risk-cellular-coverage",
      version_number: 1,
      content: {
        risk: "Offline operation may be required at remote customer sites.",
        mitigation: "Confirm offline storage and sync acceptance criteria before build start."
      },
      change_reason: "Risk captured during seed scenario setup.",
      changed_by: programManager.id,
      created_at: SEED_TIMESTAMP,
      meaningful_change: true
    }
  ];

  const traceLinks = [
    {
      link_id: "link-req-photo-to-workflow",
      project_id: SEED_PROJECT_ID,
      source_object_id: "obj-req-photo-evidence",
      target_object_id: "obj-workflow-field-intake",
      relationship_type: TRACE_RELATIONSHIP_TYPES.DERIVED_FROM,
      required_for_readiness: true,
      created_by: AI_SYSTEM_ACTOR.id,
      created_at: SEED_TIMESTAMP
    },
    {
      link_id: "link-req-photo-to-test",
      project_id: SEED_PROJECT_ID,
      source_object_id: "obj-req-photo-evidence",
      target_object_id: "obj-test-photo-evidence",
      relationship_type: TRACE_RELATIONSHIP_TYPES.VALIDATED_BY,
      required_for_readiness: true,
      created_by: AI_SYSTEM_ACTOR.id,
      created_at: SEED_TIMESTAMP
    },
    {
      link_id: "link-risk-offline-to-req",
      project_id: SEED_PROJECT_ID,
      source_object_id: "obj-risk-cellular-coverage",
      target_object_id: "obj-req-offline-sync",
      relationship_type: TRACE_RELATIONSHIP_TYPES.BLOCKS,
      required_for_readiness: false,
      created_by: programManager.id,
      created_at: SEED_TIMESTAMP
    }
  ];

  const approvals = [
    {
      approval_id: "approval-workflow-operator-001",
      object_id: "obj-workflow-field-intake",
      version_id: "ver-workflow-field-intake-001",
      approver_id: operatorRepresentative.id,
      decision: APPROVAL_DECISIONS.APPROVED,
      comment: "Workflow matches operator intake expectations for the pilot.",
      status: APPROVAL_STATUSES.ACTIVE,
      created_at: SEED_TIMESTAMP,
      invalidated_at: null,
      invalidation_reason: null
    },
    {
      approval_id: "approval-req-photo-customer-001",
      object_id: "obj-req-photo-evidence",
      version_id: "ver-req-photo-evidence-001",
      approver_id: customerPm.id,
      decision: APPROVAL_DECISIONS.CHANGES_REQUESTED,
      comment: "Confirm retention expectations before approval.",
      status: APPROVAL_STATUSES.ACTIVE,
      created_at: SEED_TIMESTAMP,
      invalidated_at: null,
      invalidation_reason: null
    }
  ];

  const readinessEvaluations = [
    {
      evaluation_id: "readiness-eval-001",
      project_id: SEED_PROJECT_ID,
      status: READINESS_STATUSES.NOT_READY,
      readiness_score: 62,
      rule_set_version: "mvp-readiness-v1",
      evaluated_at: SEED_TIMESTAMP,
      evaluated_by: AI_SYSTEM_ACTOR.id,
      summary:
        "Seed project is not ready because one requirement lacks acceptance criteria and another requires approval."
    }
  ];

  const blockers = [
    {
      blocker_id: "blocker-missing-acceptance-criteria",
      project_id: SEED_PROJECT_ID,
      object_id: "obj-req-offline-sync",
      type: BLOCKER_TYPES.MISSING_TRACEABILITY,
      severity: BLOCKER_SEVERITIES.CRITICAL,
      description: "Offline sync requirement is missing an acceptance criteria/test link.",
      status: BLOCKER_STATUSES.OPEN,
      created_at: SEED_TIMESTAMP,
      resolved_at: null
    },
    {
      blocker_id: "blocker-photo-approval",
      project_id: SEED_PROJECT_ID,
      object_id: "obj-req-photo-evidence",
      type: BLOCKER_TYPES.MISSING_APPROVAL,
      severity: BLOCKER_SEVERITIES.HIGH,
      description: "Photo evidence requirement still needs an active approval.",
      status: BLOCKER_STATUSES.OPEN,
      created_at: SEED_TIMESTAMP,
      resolved_at: null
    },
    {
      blocker_id: "blocker-cellular-risk",
      project_id: SEED_PROJECT_ID,
      object_id: "obj-risk-cellular-coverage",
      type: BLOCKER_TYPES.OPEN_CRITICAL_RISK,
      severity: BLOCKER_SEVERITIES.HIGH,
      description: "Remote cellular coverage risk requires explicit risk acceptance.",
      status: BLOCKER_STATUSES.OVERRIDDEN,
      created_at: SEED_TIMESTAMP,
      resolved_at: null
    }
  ];

  const overrides = [
    {
      override_id: "override-cellular-risk-001",
      project_id: SEED_PROJECT_ID,
      blocker_ids: ["blocker-cellular-risk"],
      authorized_by: programManager.id,
      authority_role: MVP_ROLES.PROGRAM_MANAGER,
      reason: "Pilot can proceed with a controlled offline sync validation task.",
      risk_acknowledgment:
        "Program accepts schedule risk until offline synchronization acceptance criteria are finalized.",
      created_at: SEED_TIMESTAMP,
      visibility: OVERRIDE_VISIBILITIES.DASHBOARD_AND_AUDIT_TRAIL
    }
  ];

  const certificationPackages = [
    {
      package_id: "cert-package-preview-001",
      project_id: SEED_PROJECT_ID,
      status: CERTIFICATION_PACKAGE_STATUSES.FAILED,
      generated_by: programManager.id,
      generated_at: SEED_TIMESTAMP,
      package_uri: "local://seed/certification-package-preview.json",
      includes_traceability_matrix: true,
      includes_approvals: true,
      includes_risks: true,
      includes_overrides: true
    }
  ];

  const jiraExports = [
    {
      export_job_id: "jira-export-blocked-001",
      project_id: SEED_PROJECT_ID,
      jira_project_key: "APOLLO",
      status: JIRA_EXPORT_STATUSES.FAILED,
      created_by: engineeringLead.id,
      created_at: SEED_TIMESTAMP,
      completed_at: SEED_TIMESTAMP,
      jira_issue_mappings: [],
      error_summary: "PROJECT_NOT_READY"
    }
  ];

  const users = SEEDED_MVP_USERS.map(toUserRecord);

  const roleAssignments = SEEDED_MVP_USERS.map((user) => ({
    role_assignment_id: `role-${user.id}-${SEED_PROJECT_ID}`,
    project_id: SEED_PROJECT_ID,
    user_id: user.id,
    role: user.role,
    scope: ROLE_ASSIGNMENT_SCOPES.PROJECT,
    object_id: null,
    assigned_by: programManager.id,
    assigned_at: SEED_TIMESTAMP
  }));

  const auditEvents = [
    {
      audit_event_id: "audit-project-create-001",
      project_id: SEED_PROJECT_ID,
      actor_id: programManager.id,
      event_type: AUDIT_EVENT_TYPES.CREATE,
      entity_type: "project",
      entity_id: SEED_PROJECT_ID,
      timestamp: SEED_TIMESTAMP,
      details: { name: projects[0].name },
      immutable_hash: null
    },
    {
      audit_event_id: "audit-ai-job-complete-001",
      project_id: SEED_PROJECT_ID,
      actor_id: AI_SYSTEM_ACTOR.id,
      event_type: AUDIT_EVENT_TYPES.CREATE,
      entity_type: "ai_generation_job",
      entity_id: "ai-job-001",
      timestamp: SEED_TIMESTAMP,
      details: { generated_decision_object_count: decisionObjects.length },
      immutable_hash: null
    },
    {
      audit_event_id: "audit-override-cellular-001",
      project_id: SEED_PROJECT_ID,
      actor_id: programManager.id,
      event_type: AUDIT_EVENT_TYPES.OVERRIDE,
      entity_type: "override",
      entity_id: "override-cellular-risk-001",
      timestamp: SEED_TIMESTAMP,
      details: { blocker_ids: ["blocker-cellular-risk"] },
      immutable_hash: null
    }
  ];

  return deepFreeze({
    projects,
    documents,
    aiGenerationJobs,
    decisionObjects,
    decisionObjectVersions,
    traceLinks,
    approvals,
    readinessEvaluations,
    blockers,
    overrides,
    certificationPackages,
    jiraExports,
    users,
    roleAssignments,
    auditEvents
  });
}

const COLLECTION_TABLE_MAP = Object.freeze({
  projects: "projects",
  documents: "documents",
  aiGenerationJobs: "ai_generation_jobs",
  decisionObjects: "decision_objects",
  decisionObjectVersions: "decision_object_versions",
  traceLinks: "trace_links",
  approvals: "approvals",
  readinessEvaluations: "readiness_evaluations",
  blockers: "blockers",
  overrides: "overrides",
  certificationPackages: "certification_packages",
  jiraExports: "jira_exports",
  users: "users",
  roleAssignments: "role_assignments",
  auditEvents: "audit_events"
});

export function validateMvpSeedData(seedData = createMvpSeedData()) {
  const errors = [];

  for (const [collectionName, tableName] of Object.entries(COLLECTION_TABLE_MAP)) {
    const collection = seedData[collectionName];

    if (!Array.isArray(collection) || collection.length === 0) {
      errors.push(`${collectionName} must contain at least one record.`);
      continue;
    }

    const requiredColumns = getRequiredColumns(tableName);

    for (const record of collection) {
      for (const column of requiredColumns) {
        if (record[column] === null || record[column] === undefined || record[column] === "") {
          errors.push(`${collectionName}.${column} is required.`);
        }
      }
    }
  }

  const objectIds = new Set(seedData.decisionObjects.map((object) => object.object_id));
  const versionIds = new Set(
    seedData.decisionObjectVersions.map((version) => version.version_id)
  );
  const blockerIds = new Set(seedData.blockers.map((blocker) => blocker.blocker_id));

  for (const decisionObject of seedData.decisionObjects) {
    if (!decisionObject.owner_id) {
      errors.push(`${decisionObject.object_id} must have an owner.`);
    }
  }

  for (const version of seedData.decisionObjectVersions) {
    if (!objectIds.has(version.object_id)) {
      errors.push(`${version.version_id} references a missing decision object.`);
    }
  }

  for (const approval of seedData.approvals) {
    if (!versionIds.has(approval.version_id)) {
      errors.push(`${approval.approval_id} references a missing immutable version.`);
    }
  }

  for (const override of seedData.overrides) {
    for (const blockerId of override.blocker_ids) {
      if (!blockerIds.has(blockerId)) {
        errors.push(`${override.override_id} references a missing blocker.`);
      }
    }
  }

  const requirementIds = seedData.decisionObjects
    .filter((object) => object.type === DECISION_OBJECT_TYPES.REQUIREMENT)
    .map((object) => object.object_id);
  const workflowIds = new Set(
    seedData.decisionObjects
      .filter((object) => object.type === DECISION_OBJECT_TYPES.WORKFLOW)
      .map((object) => object.object_id)
  );
  const testIds = new Set(
    seedData.decisionObjects
      .filter((object) => object.type === DECISION_OBJECT_TYPES.TEST)
      .map((object) => object.object_id)
  );

  const hasRequirementToWorkflow = requirementIds.some((requirementId) =>
    seedData.traceLinks.some(
      (link) => link.source_object_id === requirementId && workflowIds.has(link.target_object_id)
    )
  );
  const hasRequirementToTest = requirementIds.some((requirementId) =>
    seedData.traceLinks.some(
      (link) => link.source_object_id === requirementId && testIds.has(link.target_object_id)
    )
  );

  if (!hasRequirementToWorkflow) {
    errors.push("Seed data must include a requirement-to-workflow trace link.");
  }

  if (!hasRequirementToTest) {
    errors.push("Seed data must include a requirement-to-test trace link.");
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors)
  });
}
