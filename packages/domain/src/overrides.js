import { canSubmitOverride } from "./auth.js";
import {
  AUDIT_EVENT_TYPES,
  BLOCKER_STATUSES,
  OVERRIDE_VISIBILITIES
} from "./models/index.js";

export function buildOverrideRecord(
  project,
  blockers,
  input,
  actor,
  { idGenerator, now = new Date() } = {}
) {
  const blockerIds = normalizeBlockerIds(input?.blockerIds);
  const reason = `${input?.reason ?? ""}`.trim();
  const riskAcknowledgment = `${input?.riskAcknowledgment ?? ""}`.trim();
  const blockerById = new Map((blockers ?? []).map((blocker) => [blocker.blocker_id, blocker]));
  const errors = [];

  if (!project?.project_id) {
    errors.push("OVERRIDE_PROJECT_REQUIRED");
  }

  if (!canSubmitOverride(actor)) {
    errors.push("OVERRIDE_UNAUTHORIZED");
  }

  if (blockerIds.length === 0) {
    errors.push("OVERRIDE_BLOCKERS_REQUIRED");
  }

  if (!reason) {
    errors.push("OVERRIDE_REASON_REQUIRED");
  }

  if (!riskAcknowledgment) {
    errors.push("OVERRIDE_RISK_ACKNOWLEDGMENT_REQUIRED");
  }

  for (const blockerId of blockerIds) {
    const blocker = blockerById.get(blockerId);

    if (!blocker || blocker.project_id !== project?.project_id) {
      errors.push("OVERRIDE_BLOCKER_NOT_FOUND");
      continue;
    }

    if (blocker.status !== BLOCKER_STATUSES.OPEN) {
      errors.push("OVERRIDE_BLOCKER_NOT_OPEN");
    }
  }

  if (errors.length > 0) {
    return Object.freeze({
      ok: false,
      validation: Object.freeze({
        errors: Object.freeze([...new Set(errors)])
      })
    });
  }

  const createdAt = now.toISOString();
  const override = Object.freeze({
    override_id: idGenerator?.("override") ?? `override-${project.project_id}-${Date.now()}`,
    project_id: project.project_id,
    blocker_ids: Object.freeze(blockerIds),
    authorized_by: actor.id,
    authority_role: actor.role,
    reason,
    risk_acknowledgment: riskAcknowledgment,
    created_at: createdAt,
    visibility: OVERRIDE_VISIBILITIES.DASHBOARD_AND_AUDIT_TRAIL
  });
  const overriddenBlockers = Object.freeze(
    blockerIds.map((blockerId) =>
      Object.freeze({
        ...blockerById.get(blockerId),
        status: BLOCKER_STATUSES.OVERRIDDEN,
        resolved_at: createdAt
      })
    )
  );

  return Object.freeze({
    ok: true,
    override,
    overriddenBlockers
  });
}

export function buildOverrideAuditEvent(
  override,
  actor,
  { idGenerator, now = new Date() } = {}
) {
  return Object.freeze({
    audit_event_id:
      idGenerator?.("audit") ?? `audit-${override.override_id}-override-${Date.now()}`,
    project_id: override.project_id,
    actor_id: actor?.id ?? override.authorized_by,
    event_type: AUDIT_EVENT_TYPES.OVERRIDE,
    entity_type: "override",
    entity_id: override.override_id,
    timestamp: now.toISOString(),
    details: Object.freeze({
      blocker_ids: Object.freeze([...(override.blocker_ids ?? [])]),
      reason: override.reason,
      risk_acknowledgment: override.risk_acknowledgment,
      authority_role: override.authority_role,
      visibility: override.visibility
    }),
    immutable_hash: null
  });
}

export function toOverrideSummary(override) {
  return Object.freeze({
    overrideId: override.override_id,
    projectId: override.project_id,
    blockerIds: Object.freeze([...(override.blocker_ids ?? [])]),
    authorizedBy: override.authorized_by,
    authorityRole: override.authority_role,
    reason: override.reason,
    riskAcknowledgment: override.risk_acknowledgment,
    createdAt: override.created_at,
    visibility: override.visibility
  });
}

function normalizeBlockerIds(blockerIds) {
  if (!Array.isArray(blockerIds)) {
    return [];
  }

  return [
    ...new Set(
      blockerIds.map((blockerId) => `${blockerId}`.trim()).filter(Boolean)
    )
  ];
}
