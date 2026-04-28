const id = (name) => ({ name, type: "text", nullable: false, primaryKey: true });
const text = (name, nullable = false) => ({ name, type: "text", nullable });
const integer = (name, nullable = false) => ({ name, type: "integer", nullable });
const boolean = (name, nullable = false) => ({ name, type: "boolean", nullable });
const timestamp = (name, nullable = false) => ({ name, type: "timestamptz", nullable });
const json = (name, nullable = false) => ({ name, type: "jsonb", nullable });
const textArray = (name, nullable = false) => ({ name, type: "text[]", nullable });

export const MVP_SCHEMA_VERSION = "202604280003_mvp_schema";

export const MVP_TABLES = Object.freeze([
  Object.freeze({
    name: "projects",
    columns: Object.freeze([
      id("project_id"),
      text("name"),
      text("description", true),
      text("customer", true),
      text("contract_number", true),
      text("program_name", true),
      text("status"),
      text("readiness_status"),
      integer("readiness_score", true),
      text("created_by"),
      timestamp("created_at"),
      timestamp("updated_at")
    ])
  }),
  Object.freeze({
    name: "documents",
    columns: Object.freeze([
      id("document_id"),
      text("project_id"),
      text("file_name"),
      text("document_type", true),
      text("storage_uri"),
      text("upload_status"),
      text("uploaded_by"),
      timestamp("uploaded_at"),
      text("extracted_text_uri", true),
      text("checksum")
    ])
  }),
  Object.freeze({
    name: "ai_generation_jobs",
    columns: Object.freeze([
      id("generation_job_id"),
      text("project_id"),
      textArray("document_ids"),
      text("status"),
      textArray("generation_scope"),
      text("ai_schema_version"),
      text("created_by"),
      timestamp("created_at"),
      timestamp("completed_at", true),
      text("error_message", true)
    ])
  }),
  Object.freeze({
    name: "decision_objects",
    columns: Object.freeze([
      id("object_id"),
      text("project_id"),
      text("type"),
      text("title"),
      integer("current_version"),
      text("status"),
      text("owner_id"),
      text("priority", true),
      text("created_by"),
      timestamp("created_at"),
      timestamp("updated_at")
    ])
  }),
  Object.freeze({
    name: "decision_object_versions",
    columns: Object.freeze([
      id("version_id"),
      text("object_id"),
      integer("version_number"),
      json("content"),
      text("change_reason", true),
      text("changed_by"),
      timestamp("created_at"),
      boolean("meaningful_change")
    ])
  }),
  Object.freeze({
    name: "trace_links",
    columns: Object.freeze([
      id("link_id"),
      text("project_id"),
      text("source_object_id"),
      text("target_object_id"),
      text("relationship_type"),
      boolean("required_for_readiness"),
      text("created_by"),
      timestamp("created_at")
    ])
  }),
  Object.freeze({
    name: "approvals",
    columns: Object.freeze([
      id("approval_id"),
      text("object_id"),
      text("version_id"),
      text("approver_id"),
      text("decision"),
      text("comment", true),
      text("status"),
      timestamp("created_at"),
      timestamp("invalidated_at", true),
      text("invalidation_reason", true)
    ])
  }),
  Object.freeze({
    name: "readiness_evaluations",
    columns: Object.freeze([
      id("evaluation_id"),
      text("project_id"),
      text("status"),
      integer("readiness_score"),
      text("rule_set_version"),
      timestamp("evaluated_at"),
      text("evaluated_by"),
      text("summary", true)
    ])
  }),
  Object.freeze({
    name: "blockers",
    columns: Object.freeze([
      id("blocker_id"),
      text("project_id"),
      text("object_id", true),
      text("type"),
      text("severity"),
      text("description"),
      text("status"),
      timestamp("created_at"),
      timestamp("resolved_at", true)
    ])
  }),
  Object.freeze({
    name: "overrides",
    columns: Object.freeze([
      id("override_id"),
      text("project_id"),
      textArray("blocker_ids"),
      text("authorized_by"),
      text("authority_role"),
      text("reason"),
      text("risk_acknowledgment"),
      timestamp("created_at"),
      text("visibility")
    ])
  }),
  Object.freeze({
    name: "certification_packages",
    columns: Object.freeze([
      id("package_id"),
      text("project_id"),
      text("status"),
      text("generated_by"),
      timestamp("generated_at"),
      text("package_uri"),
      boolean("includes_traceability_matrix"),
      boolean("includes_approvals"),
      boolean("includes_risks"),
      boolean("includes_overrides")
    ])
  }),
  Object.freeze({
    name: "jira_exports",
    columns: Object.freeze([
      id("export_job_id"),
      text("project_id"),
      text("jira_project_key"),
      text("status"),
      text("created_by"),
      timestamp("created_at"),
      timestamp("completed_at", true),
      json("jira_issue_mappings", true),
      text("error_summary", true)
    ])
  }),
  Object.freeze({
    name: "users",
    columns: Object.freeze([
      id("user_id"),
      text("external_identity_id"),
      text("name"),
      text("email"),
      text("organization_id"),
      text("status"),
      timestamp("created_at")
    ])
  }),
  Object.freeze({
    name: "role_assignments",
    columns: Object.freeze([
      id("role_assignment_id"),
      text("project_id"),
      text("user_id"),
      text("role"),
      text("scope"),
      text("object_id", true),
      text("assigned_by"),
      timestamp("assigned_at")
    ])
  }),
  Object.freeze({
    name: "audit_events",
    columns: Object.freeze([
      id("audit_event_id"),
      text("project_id", true),
      text("actor_id", true),
      text("event_type"),
      text("entity_type"),
      text("entity_id", true),
      timestamp("timestamp"),
      json("details"),
      text("immutable_hash", true)
    ])
  })
]);

export function listMvpTableNames() {
  return MVP_TABLES.map((table) => table.name);
}

export function getRequiredColumns(tableName) {
  const table = MVP_TABLES.find((candidate) => candidate.name === tableName);

  if (!table) {
    throw new Error(`Unknown MVP table: ${tableName}`);
  }

  return table.columns
    .filter((column) => column.nullable !== true)
    .map((column) => column.name);
}

export function getMvpSchema() {
  return Object.freeze({
    version: MVP_SCHEMA_VERSION,
    tables: MVP_TABLES
  });
}
