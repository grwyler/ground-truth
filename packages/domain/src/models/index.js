export const PROJECT_STATUSES = Object.freeze({
  DRAFT: "draft",
  IN_REVIEW: "in_review",
  NOT_READY: "not_ready",
  READY: "ready",
  ARCHIVED: "archived"
});

export const READINESS_STATUSES = Object.freeze({
  READY: "ready",
  NOT_READY: "not_ready"
});

export const DOCUMENT_TYPES = Object.freeze({
  SOW: "sow",
  PROPOSAL: "proposal",
  LEGACY_DOCUMENT: "legacy_document",
  NOTES: "notes",
  CONSTRAINT: "constraint",
  OTHER: "other"
});

export const DOCUMENT_UPLOAD_STATUSES = Object.freeze({
  UPLOADED: "uploaded",
  PROCESSING: "processing",
  PARSED: "parsed",
  FAILED: "failed"
});

export const AI_JOB_STATUSES = Object.freeze({
  QUEUED: "queued",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed"
});

export const DECISION_OBJECT_TYPES = Object.freeze({
  WORKFLOW: "workflow",
  REQUIREMENT: "requirement",
  TEST: "test",
  RISK: "risk"
});

export const DECISION_OBJECT_STATUSES = Object.freeze({
  DRAFT: "draft",
  IN_REVIEW: "in_review",
  APPROVED: "approved",
  REJECTED: "rejected",
  INVALIDATED: "invalidated"
});

export const PRIORITIES = Object.freeze({
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low"
});

export const TRACE_RELATIONSHIP_TYPES = Object.freeze({
  DERIVED_FROM: "derived_from",
  VALIDATED_BY: "validated_by",
  DEPENDS_ON: "depends_on",
  IMPLEMENTS: "implements",
  REFERENCES: "references",
  BLOCKS: "blocks"
});

export const APPROVAL_DECISIONS = Object.freeze({
  APPROVED: "approved",
  REJECTED: "rejected",
  CHANGES_REQUESTED: "changes_requested"
});

export const APPROVAL_STATUSES = Object.freeze({
  ACTIVE: "active",
  INVALIDATED: "invalidated"
});

export const BLOCKER_TYPES = Object.freeze({
  MISSING_APPROVAL: "missing_approval",
  MISSING_TRACEABILITY: "missing_traceability",
  OPEN_CRITICAL_RISK: "open_critical_risk",
  INFRASTRUCTURE_GAP: "infrastructure_gap",
  JIRA_EXPORT_BLOCKED: "jira_export_blocked"
});

export const BLOCKER_SEVERITIES = Object.freeze({
  CRITICAL: "critical",
  HIGH: "high"
});

export const BLOCKER_STATUSES = Object.freeze({
  OPEN: "open",
  RESOLVED: "resolved",
  OVERRIDDEN: "overridden"
});

export const OVERRIDE_VISIBILITIES = Object.freeze({
  DASHBOARD_AND_AUDIT_TRAIL: "dashboard_and_audit_trail"
});

export const CERTIFICATION_PACKAGE_STATUSES = Object.freeze({
  GENERATED: "generated",
  FAILED: "failed",
  SUPERSEDED: "superseded"
});

export const JIRA_EXPORT_STATUSES = Object.freeze({
  QUEUED: "queued",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  PARTIAL: "partial"
});

export const USER_STATUSES = Object.freeze({
  ACTIVE: "active",
  DISABLED: "disabled"
});

export const ROLE_ASSIGNMENT_SCOPES = Object.freeze({
  PROJECT: "project",
  OBJECT: "object"
});

export const AUDIT_EVENT_TYPES = Object.freeze({
  CREATE: "create",
  UPDATE: "update",
  APPROVE: "approve",
  REJECT: "reject",
  OVERRIDE: "override",
  EXPORT: "export",
  LOGIN: "login",
  PERMISSION_DENIED: "permission_denied"
});
