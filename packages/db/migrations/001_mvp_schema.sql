-- MVP-003 baseline schema for the decision-object-centric readiness model.
-- The app currently uses dependency-free Node modules, so this migration is
-- checked in as the durable PostgreSQL contract for the future database runner.

CREATE TABLE IF NOT EXISTS projects (
  project_id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  customer text,
  contract_number text,
  program_name text,
  status text NOT NULL,
  readiness_status text NOT NULL,
  readiness_score integer,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  document_id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(project_id),
  file_name text NOT NULL,
  document_type text,
  storage_uri text NOT NULL,
  upload_status text NOT NULL,
  uploaded_by text NOT NULL,
  uploaded_at timestamptz NOT NULL,
  extracted_text_uri text,
  checksum text NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_generation_jobs (
  generation_job_id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(project_id),
  document_ids text[] NOT NULL,
  status text NOT NULL,
  generation_scope text[] NOT NULL,
  ai_schema_version text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL,
  completed_at timestamptz,
  error_message text
);

CREATE TABLE IF NOT EXISTS decision_objects (
  object_id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(project_id),
  type text NOT NULL,
  title text NOT NULL,
  current_version integer NOT NULL,
  status text NOT NULL,
  owner_id text NOT NULL,
  priority text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS decision_object_versions (
  version_id text PRIMARY KEY,
  object_id text NOT NULL REFERENCES decision_objects(object_id),
  version_number integer NOT NULL,
  content jsonb NOT NULL,
  change_reason text,
  changed_by text NOT NULL,
  created_at timestamptz NOT NULL,
  meaningful_change boolean NOT NULL,
  UNIQUE (object_id, version_number)
);

CREATE TABLE IF NOT EXISTS trace_links (
  link_id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(project_id),
  source_object_id text NOT NULL REFERENCES decision_objects(object_id),
  target_object_id text NOT NULL REFERENCES decision_objects(object_id),
  relationship_type text NOT NULL,
  required_for_readiness boolean NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS approvals (
  approval_id text PRIMARY KEY,
  object_id text NOT NULL REFERENCES decision_objects(object_id),
  version_id text NOT NULL REFERENCES decision_object_versions(version_id),
  approver_id text NOT NULL,
  decision text NOT NULL,
  comment text,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  invalidated_at timestamptz,
  invalidation_reason text
);

CREATE TABLE IF NOT EXISTS readiness_evaluations (
  evaluation_id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(project_id),
  status text NOT NULL,
  readiness_score integer NOT NULL,
  rule_set_version text NOT NULL,
  evaluated_at timestamptz NOT NULL,
  evaluated_by text NOT NULL,
  summary text
);

CREATE TABLE IF NOT EXISTS blockers (
  blocker_id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(project_id),
  object_id text REFERENCES decision_objects(object_id),
  type text NOT NULL,
  severity text NOT NULL,
  description text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS overrides (
  override_id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(project_id),
  blocker_ids text[] NOT NULL,
  authorized_by text NOT NULL,
  authority_role text NOT NULL,
  reason text NOT NULL,
  risk_acknowledgment text NOT NULL,
  created_at timestamptz NOT NULL,
  visibility text NOT NULL
);

CREATE TABLE IF NOT EXISTS certification_packages (
  package_id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(project_id),
  status text NOT NULL,
  generated_by text NOT NULL,
  generated_at timestamptz NOT NULL,
  package_uri text NOT NULL,
  includes_traceability_matrix boolean NOT NULL,
  includes_approvals boolean NOT NULL,
  includes_risks boolean NOT NULL,
  includes_overrides boolean NOT NULL
);

CREATE TABLE IF NOT EXISTS jira_exports (
  export_job_id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(project_id),
  jira_project_key text NOT NULL,
  status text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL,
  completed_at timestamptz,
  jira_issue_mappings jsonb,
  error_summary text
);

CREATE TABLE IF NOT EXISTS users (
  user_id text PRIMARY KEY,
  external_identity_id text NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  organization_id text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS role_assignments (
  role_assignment_id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(project_id),
  user_id text NOT NULL REFERENCES users(user_id),
  role text NOT NULL,
  scope text NOT NULL,
  object_id text,
  assigned_by text NOT NULL,
  assigned_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  audit_event_id text PRIMARY KEY,
  project_id text REFERENCES projects(project_id),
  actor_id text,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  timestamp timestamptz NOT NULL,
  details jsonb NOT NULL,
  immutable_hash text
);
