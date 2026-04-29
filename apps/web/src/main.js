import {
  AI_SYSTEM_ACTOR,
  APPROVAL_DECISIONS,
  APPROVAL_STATUSES,
  DECISION_OBJECT_TYPES,
  DRAFT_REVIEW_STATUSES,
  DOCUMENT_UPLOAD_STATUSES,
  DOCUMENT_VALIDATION_ERRORS,
  BLOCKER_STATUSES,
  BLOCKER_TYPES,
  TRACE_RELATIONSHIP_TYPES,
  acceptDecisionDraft,
  buildAcceptanceCriteriaCreate,
  buildApprovalInvalidations,
  buildApprovalAuditEvent,
  buildApprovalDecision,
  buildAiGenerationAuditEvent,
  buildCertificationPackage,
  buildCertificationPackageAuditEvent,
  buildDecisionObjectCreate,
  buildDecisionObjectUpdate,
  buildJiraExportAuditEvent,
  buildJiraExportJob,
  buildJiraExportPreview,
  buildVersionDiff,
  buildOwnerAssignment,
  buildDocumentRecord,
  buildGeneratedPlan,
  buildOverrideAuditEvent,
  buildOverrideRecord,
  buildQueuedAiGenerationJob,
  buildTraceLinkCreate,
  evaluateProjectReadiness,
  isRejectedDecisionDraft,
  isSupportedDocumentFileName,
  getApplicationMetadata,
  isApprovalQueueItemForActor,
  markAiGenerationJobCompleted,
  markAiGenerationJobFailed,
  markAiGenerationJobRunning,
  normalizeAiDraftOutput,
  rejectDecisionDraft,
  READINESS_STATUSES,
  SEEDED_MVP_USERS,
  toAiGenerationJobSummary,
  toAcceptanceCriteriaSummary,
  toAuditEventSummary,
  toApprovalQueueItem,
  toApprovalSummary,
  toCertificationPackageSummary,
  toDecisionObjectSummary,
  toDocumentSummary,
  toJiraExportJobSummary,
  toOverrideSummary,
  toProjectSummary,
  toReadinessResponse,
  toTraceLinkSummary
} from "../../../packages/domain/src/index.js";
import { createMvpSeedData } from "../../../packages/db/src/index.js";
import { createDeterministicDraftAdapter } from "../../../packages/ai/src/index.js";
import { createMockJiraAdapter } from "../../../packages/integrations/jira/src/index.js";
import { createLocalCurrentUser } from "./lib/session/current-user.js";

export function renderAppShell(
  container,
  metadata = getApplicationMetadata(),
  currentUser = createLocalCurrentUser(),
  projectService = createLocalProjectService(),
  documentService = createLocalDocumentService(),
  aiGenerationService = createLocalAiGenerationService(projectService, documentService)
) {
  if (!container) {
    throw new Error("A container element is required to render the app shell.");
  }

  container.innerHTML = "";

  const shell = document.createElement("section");
  shell.className = "app-shell";

  const header = document.createElement("header");
  header.className = "workspace-header";

  const title = document.createElement("h1");
  title.textContent = "Plan Generator";

  const summary = document.createElement("p");
  summary.className = "summary";
  summary.textContent =
    "Upload a vague SOW \u2192 generate workflows, requirements, acceptance criteria, risks, and Jira-ready tickets in minutes.";
  header.append(title, summary);
  shell.append(header);

  const content = document.createElement("div");
  content.className = "project-layout single-column";
  const workspace = document.createElement("section");
  workspace.className = "project-workspace";
  workspace.setAttribute("aria-label", "Plan workspace");

  content.append(workspace);
  shell.append(content);
  container.append(shell);

  renderProjectWorkspace(
    workspace,
    projectService.listProjects()[0] ?? null,
    currentUser,
    documentService,
    aiGenerationService
  );

  return shell;
}

export function createLocalProjectService(projects = createMvpSeedData().projects.map(toProjectSummary)) {
  const projectState = [...projects];

  return Object.freeze({
    listProjects() {
      return [...projectState];
    },

    createProject(input, actor) {
      const now = new Date().toISOString();
      const project = {
        projectId: `local-project-${projectState.length + 1}`,
        name: input.name.trim(),
        description: input.description.trim() || null,
        customer: input.customer.trim() || null,
        contractNumber: input.contractNumber.trim() || null,
        programName: input.programName.trim() || null,
        status: "draft",
        readinessStatus: "not_ready",
        readinessScore: 0,
        createdBy: actor.id,
        createdAt: now,
        updatedAt: now
      };

      projectState.unshift(project);
      return project;
    }
  });
}

export function createLocalDocumentService(
  documents = createMvpSeedData().documents.map(toDocumentSummary)
) {
  const documentState = [...documents];

  return Object.freeze({
    listDocuments(projectId) {
      return documentState.filter((document) => document.projectId === projectId);
    },

    uploadDocuments(projectId, files, actor) {
      const uploaded = [];
      const errors = [];

      for (const file of Array.from(files)) {
        if (!isSupportedDocumentFileName(file.name)) {
          errors.push(`${file.name}: unsupported file type`);
          continue;
        }

        if (file.size <= 0) {
          errors.push(`${file.name}: empty files cannot be uploaded`);
          continue;
        }

        const result = buildDocumentRecord(
          {
            projectId,
            fileName: file.name,
            storageUri: `local://browser/${projectId}/${file.name}`,
            byteLength: file.size,
            checksum: `sha256:browser-${documentState.length + uploaded.length + 1}`
          },
          actor,
          {
            idGenerator: () => `local-doc-${documentState.length + uploaded.length + 1}`
          }
        );

        if (!result.ok) {
          errors.push(...result.validation.errors.map(formatDocumentValidationError));
          continue;
        }

        const document = toDocumentSummary(result.document);
        documentState.push(document);
        uploaded.push(document);
      }

      return { uploaded, errors };
    }
  });
}

export function createLocalAiGenerationService(
  projectService = createLocalProjectService(),
  documentService = createLocalDocumentService(),
  aiDraftAdapter = createDeterministicDraftAdapter(),
  seedData = createMvpSeedData()
) {
  const jobs = [...(seedData.aiGenerationJobs ?? [])];
  const decisionObjects = [...(seedData.decisionObjects ?? [])];
  const decisionObjectVersions = [...(seedData.decisionObjectVersions ?? [])];
  const traceLinks = [...(seedData.traceLinks ?? [])];
  const approvals = [...(seedData.approvals ?? [])];
  const overrides = [...(seedData.overrides ?? [])];
  const certificationPackages = [...(seedData.certificationPackages ?? [])];
  const jiraExports = [...(seedData.jiraExports ?? [])];
  const auditEvents = [...(seedData.auditEvents ?? [])];
  let draftIdSequence = 0;

  function listDecisionObjects(projectId) {
      return decisionObjects
        .filter((decisionObject) => decisionObject.project_id === projectId)
        .map((decisionObject) => {
          const version = decisionObjectVersions.find(
            (candidate) =>
              candidate.object_id === decisionObject.object_id &&
              candidate.version_number === decisionObject.current_version
          );

          return toDecisionObjectSummary(decisionObject, version);
        });
  }

  function getGeneratedPlan(projectId) {
    const project = projectService.listProjects().find((candidate) => candidate.projectId === projectId);

    if (!project) {
      return null;
    }

    const documents = documentService.listDocuments(projectId).map(toDocumentRecord);
    const result = buildGeneratedPlan(toProjectRecord(project), documents, {
      decisionObjects,
      decisionObjectVersions,
      traceLinks
    });

    return result.ok ? result.plan : null;
  }

  function findDraft(projectId, objectId) {
    const decisionObject = decisionObjects.find(
      (candidate) => candidate.project_id === projectId && candidate.object_id === objectId
    );

    if (!decisionObject) {
      return null;
    }

    const version = decisionObjectVersions.find(
      (candidate) =>
        candidate.object_id === decisionObject.object_id &&
        candidate.version_number === decisionObject.current_version
    );

    return { decisionObject, version };
  }

  function persistDraftUpdate(update) {
    const objectIndex = decisionObjects.findIndex(
      (candidate) => candidate.object_id === update.decisionObject.object_id
    );
    const versionIndex = decisionObjectVersions.findIndex(
      (candidate) => candidate.version_id === update.version.version_id
    );

    decisionObjects[objectIndex] = update.decisionObject;

    if (versionIndex === -1) {
      decisionObjectVersions.push(update.version);
    } else {
      decisionObjectVersions[versionIndex] = update.version;
    }

    return toDecisionObjectSummary(update.decisionObject, update.version);
  }

  function listTraceLinks(projectId, objectId) {
    return traceLinks
      .filter(
        (traceLink) =>
          traceLink.project_id === projectId &&
          (traceLink.source_object_id === objectId || traceLink.target_object_id === objectId)
      )
      .map((traceLink) =>
        toTraceLinkSummary(
          traceLink,
          decisionObjects.find((candidate) => candidate.object_id === traceLink.source_object_id),
          decisionObjects.find((candidate) => candidate.object_id === traceLink.target_object_id)
        )
      );
  }

  function listAcceptanceCriteria(projectId, requirementObjectId) {
    return traceLinks
      .filter(
        (traceLink) =>
          traceLink.project_id === projectId &&
          traceLink.source_object_id === requirementObjectId &&
          traceLink.relationship_type === TRACE_RELATIONSHIP_TYPES.VALIDATED_BY
      )
      .map((traceLink) => {
        const testObject = decisionObjects.find(
          (candidate) => candidate.object_id === traceLink.target_object_id
        );
        const version = testObject
          ? decisionObjectVersions.find(
              (candidate) =>
                candidate.object_id === testObject.object_id &&
                candidate.version_number === testObject.current_version
            )
          : null;

        return testObject && version
          ? toAcceptanceCriteriaSummary(testObject, version, traceLink)
          : null;
      })
      .filter(Boolean);
  }

  function listAssignableOwners() {
    return SEEDED_MVP_USERS.map((user) => ({
      userId: user.id,
      displayName: user.displayName,
      email: user.email,
      role: user.role
    }));
  }

  function listApprovals(projectId) {
    const objectIds = new Set(
      decisionObjects
        .filter((decisionObject) => decisionObject.project_id === projectId)
        .map((decisionObject) => decisionObject.object_id)
    );

    return approvals
      .filter((approval) => objectIds.has(approval.object_id))
      .map((approval) => {
        const decisionObject = decisionObjects.find(
          (candidate) => candidate.object_id === approval.object_id
        );
        const version = decisionObjectVersions.find(
          (candidate) => candidate.version_id === approval.version_id
        );

        return toApprovalSummary(approval, decisionObject, version);
      });
  }

  function listApprovalQueue(projectId, actor) {
    return decisionObjects
      .filter((decisionObject) => decisionObject.project_id === projectId)
      .map((decisionObject) => {
        const version = decisionObjectVersions.find(
          (candidate) =>
            candidate.object_id === decisionObject.object_id &&
            candidate.version_number === decisionObject.current_version
        );
        const objectApprovals = approvals.filter(
          (approval) => approval.object_id === decisionObject.object_id
        );

        return { decisionObject, version, objectApprovals };
      })
      .filter(({ decisionObject, version, objectApprovals }) =>
        isApprovalQueueItemForActor(decisionObject, version, objectApprovals, actor)
      )
      .map(({ decisionObject, version, objectApprovals }) => {
        const latestInvalidatedApproval = objectApprovals
          .filter((approval) => approval.status === APPROVAL_STATUSES.INVALIDATED)
          .at(-1);
        const previousVersion = latestInvalidatedApproval
          ? decisionObjectVersions.find(
              (candidate) => candidate.version_id === latestInvalidatedApproval.version_id
            )
          : null;
        const diff =
          previousVersion && version
            ? buildVersionDiff(decisionObject, previousVersion, version)
            : null;

        return {
          ...toApprovalQueueItem(decisionObject, version, objectApprovals),
          traceabilityStatus: summarizeTraceabilityForApproval(projectId, decisionObject),
          invalidatedApproval: latestInvalidatedApproval
            ? toApprovalSummary(latestInvalidatedApproval, decisionObject, previousVersion)
            : null,
          diff: diff?.ok ? diff.diff : null
        };
      });
  }

  function summarizeTraceabilityForApproval(projectId, decisionObject) {
    if (decisionObject.type !== DECISION_OBJECT_TYPES.REQUIREMENT) {
      return "Traceability is not required for this object type.";
    }

    const links = listTraceLinks(projectId, decisionObject.object_id);
    const hasWorkflowLink = links.some(
      (link) =>
        link.sourceObjectId === decisionObject.object_id &&
        link.relationshipType === TRACE_RELATIONSHIP_TYPES.DERIVED_FROM &&
        link.targetType === DECISION_OBJECT_TYPES.WORKFLOW
    );
    const hasTestLink = links.some(
      (link) =>
        link.sourceObjectId === decisionObject.object_id &&
        link.relationshipType === TRACE_RELATIONSHIP_TYPES.VALIDATED_BY &&
        link.targetType === DECISION_OBJECT_TYPES.TEST
    );

    return `Workflow ${hasWorkflowLink ? "linked" : "missing"}; test ${
      hasTestLink ? "linked" : "missing"
    }.`;
  }

  function getReadinessDashboard(projectId) {
    const project = projectService
      .listProjects()
      .find((candidate) => candidate.projectId === projectId);

    if (!project) {
      return null;
    }

    const projectDecisionObjects = decisionObjects.filter(
      (decisionObject) => decisionObject.project_id === projectId
    );
    const projectDecisionObjectIds = new Set(
      projectDecisionObjects.map((decisionObject) => decisionObject.object_id)
    );
    const result = evaluateProjectReadiness(toProjectRecord(project), {
      decisionObjects: projectDecisionObjects,
      decisionObjectVersions: decisionObjectVersions.filter((version) =>
        projectDecisionObjectIds.has(version.object_id)
      ),
      traceLinks: traceLinks.filter((traceLink) => traceLink.project_id === projectId),
      approvals: approvals.filter((approval) => projectDecisionObjectIds.has(approval.object_id)),
      overrides: overrides.filter((override) => override.project_id === projectId)
    });
    const readiness = toReadinessResponse(result, toProjectRecord(project));
    const owners = listAssignableOwners();
    const hardBlockers = readiness.hardBlockers.map((blocker) => ({
      ...blocker,
      ownerName: formatOwner(blocker.ownerId, owners),
      fixLabel: getBlockerFixLabel(blocker)
    }));
    const resolvedBlockers = readiness.resolvedBlockers.map((blocker) => ({
      ...blocker,
      ownerName: formatOwner(blocker.ownerId, owners),
      fixLabel: getBlockerFixLabel(blocker)
    }));
    const openRisks = projectDecisionObjects.filter(
      (decisionObject) =>
        decisionObject.type === DECISION_OBJECT_TYPES.RISK &&
        decisionObject.status !== "rejected"
    );

    return Object.freeze({
      ...readiness,
      hardBlockers: Object.freeze(hardBlockers),
      resolvedBlockers: Object.freeze(resolvedBlockers),
      pendingApprovalCount: hardBlockers.filter(
        (blocker) => blocker.type === BLOCKER_TYPES.MISSING_APPROVAL
      ).length,
      openRiskCount: openRisks.length,
      overrideCount: readiness.overrides.length,
      jiraExportDisabled: readiness.status !== READINESS_STATUSES.READY,
      scoreBreakdown: Object.freeze({
        hardBlockers: hardBlockers.length,
        resolvedBlockers: resolvedBlockers.length,
        warnings: readiness.warnings.length,
        ruleSetVersion: readiness.ruleSetVersion
      })
    });
  }

  function getCertificationInputs(projectId) {
    const projectDecisionObjects = decisionObjects.filter(
      (decisionObject) => decisionObject.project_id === projectId
    );
    const projectDecisionObjectIds = new Set(
      projectDecisionObjects.map((decisionObject) => decisionObject.object_id)
    );

    return {
      decisionObjects: projectDecisionObjects,
      decisionObjectVersions: decisionObjectVersions.filter((version) =>
        projectDecisionObjectIds.has(version.object_id)
      ),
      traceLinks: traceLinks.filter((traceLink) => traceLink.project_id === projectId),
      approvals: approvals.filter((approval) => projectDecisionObjectIds.has(approval.object_id)),
      overrides: overrides.filter((override) => override.project_id === projectId)
    };
  }

  return Object.freeze({
    listDecisionObjects,

    getGeneratedPlan,

    listAssignableOwners,

    listTraceLinks,

    listAcceptanceCriteria,

    listApprovals,

    listApprovalQueue,

    getReadinessDashboard,

    listCertificationPackages(projectId) {
      return certificationPackages
        .filter((packageRecord) => packageRecord.project_id === projectId)
        .map((packageRecord) => toCertificationPackageSummary(packageRecord));
    },

    listJiraExports(projectId) {
      return jiraExports
        .filter((exportJob) => exportJob.project_id === projectId)
        .map((exportJob) => toJiraExportJobSummary(exportJob));
    },

    exportToJira(projectId, input, actor, jiraAdapter = createMockJiraAdapter()) {
      const project = projectService
        .listProjects()
        .find((candidate) => candidate.projectId === projectId);

      if (!project) {
        return { ok: false, error: "Project was not found." };
      }

      const exportInputs = getCertificationInputs(projectId);
      const readinessResult = evaluateProjectReadiness(toProjectRecord(project), exportInputs);
      const previewResult = buildJiraExportPreview(
        toProjectRecord(project),
        readinessResult,
        exportInputs,
        input,
        actor
      );

      if (!previewResult.ok) {
        return {
          ok: false,
          error: previewResult.validation.errors.includes("PROJECT_NOT_READY")
            ? "Jira export is blocked by readiness rules. Enable allowWhenNotReady for MVP demos."
            : "Enter a valid Jira project key and use an authorized export role."
        };
      }

      const adapterResult = jiraAdapter.exportPreview(previewResult.preview, input);
      const exportJob = buildJiraExportJob(
        toProjectRecord(project),
        previewResult.preview,
        adapterResult,
        input,
        actor,
        {
          idGenerator: (kind) => {
            draftIdSequence += 1;
            return `local-${kind}-${draftIdSequence}`;
          }
        }
      );

      jiraExports.push(exportJob);
      auditEvents.push(
        buildJiraExportAuditEvent(exportJob, actor, {
          idGenerator: (kind) => {
            draftIdSequence += 1;
            return `local-${kind}-${draftIdSequence}`;
          }
        })
      );

      const summary = toJiraExportJobSummary(exportJob);

      return {
        ok: summary.status === "completed" || summary.status === "partial",
        exportJob: summary,
        error:
          summary.status === "failed"
            ? summary.errors[0]?.message ?? "Jira export failed."
            : null
      };
    },

    generateCertificationPackage(projectId, input, actor) {
      const project = projectService
        .listProjects()
        .find((candidate) => candidate.projectId === projectId);

      if (!project) {
        return { ok: false, error: "Project was not found." };
      }

      const packageInputs = getCertificationInputs(projectId);
      const readinessResult = evaluateProjectReadiness(toProjectRecord(project), packageInputs);
      const result = buildCertificationPackage(
        toProjectRecord(project),
        readinessResult,
        packageInputs,
        input,
        actor,
        {
          idGenerator: (kind) => {
            draftIdSequence += 1;
            return `local-${kind}-${draftIdSequence}`;
          }
        }
      );

      if (!result.ok) {
        return {
          ok: false,
          error: result.validation.errors.includes("PROJECT_NOT_READY")
            ? "Certification package generation is blocked until Ready-to-Build or valid override state."
            : "You do not have permission to generate the certification package."
        };
      }

      certificationPackages.push(result.package);
      auditEvents.push(
        buildCertificationPackageAuditEvent(result.package, actor, {
          idGenerator: (kind) => {
            draftIdSequence += 1;
            return `local-${kind}-${draftIdSequence}`;
          }
        })
      );

      return {
        ok: true,
        package: toCertificationPackageSummary(result.package, result.artifact)
      };
    },

    createDecisionObject(projectId, input, actor) {
      const created = buildDecisionObjectCreate(
        {
          ...input,
          projectId
        },
        actor,
        {
          idGenerator: (kind) => {
            draftIdSequence += 1;
            return `local-${kind}-${draftIdSequence}`;
          }
        }
      );

      if (!created.ok) {
        return { ok: false, error: "Type, title, and structured content are required." };
      }

      decisionObjects.push(created.decisionObject);
      decisionObjectVersions.push(created.version);

      return {
        ok: true,
        decisionObject: toDecisionObjectSummary(created.decisionObject, created.version)
      };
    },

    updateDraft(projectId, objectId, input, actor) {
      const draft = findDraft(projectId, objectId);

      if (!draft) {
        return { ok: false, error: "Draft object was not found." };
      }

      const update = buildDecisionObjectUpdate(
        draft.decisionObject,
        draft.version,
        input,
        actor,
        {
          idGenerator: (kind) => {
            draftIdSequence += 1;
            return `local-${kind}-${draftIdSequence}`;
          }
        }
      );

      if (!update.ok) {
        return {
          ok: false,
          error: "Draft title and structured content are required."
        };
      }

      const invalidation = update.meaningfulChange
        ? buildApprovalInvalidations(
            approvals.filter((approval) => approval.object_id === draft.decisionObject.object_id),
            draft.decisionObject,
            draft.version,
            update.version,
            actor,
            {
              idGenerator: (kind) => {
                draftIdSequence += 1;
                return `local-${kind}-${draftIdSequence}`;
              }
            }
          )
        : { invalidatedApprovals: [], auditEvents: [] };

      for (const invalidatedApproval of invalidation.invalidatedApprovals) {
        const approvalIndex = approvals.findIndex(
          (approval) => approval.approval_id === invalidatedApproval.approval_id
        );

        if (approvalIndex !== -1) {
          approvals[approvalIndex] = invalidatedApproval;
        }
      }
      auditEvents.push(...invalidation.auditEvents);

      return {
        ok: true,
        decisionObject: persistDraftUpdate(update),
        invalidatedApprovals: invalidation.invalidatedApprovals.map((approval) =>
          toApprovalSummary(approval, update.decisionObject, draft.version)
        )
      };
    },

    assignOwner(projectId, objectId, ownerId, actor) {
      const draft = findDraft(projectId, objectId);

      if (!draft) {
        return { ok: false, error: "Decision object was not found." };
      }

      const assignment = buildOwnerAssignment(
        draft.decisionObject,
        { ownerId },
        actor,
        {
          assignableOwners: listAssignableOwners()
        }
      );

      if (!assignment.ok) {
        return { ok: false, error: "Select an owner assigned to this project." };
      }

      return {
        ok: true,
        decisionObject: persistDraftUpdate({
          decisionObject: assignment.decisionObject,
          version: draft.version
        })
      };
    },

    createTraceLink(projectId, sourceObjectId, input, actor) {
      const source = findDraft(projectId, sourceObjectId)?.decisionObject;
      const target = findDraft(projectId, input.targetObjectId)?.decisionObject;
      const result = buildTraceLinkCreate(source, target, input, actor, {
        idGenerator: (kind) => {
          draftIdSequence += 1;
          return `local-${kind}-${draftIdSequence}`;
        }
      });

      if (!result.ok) {
        return { ok: false, error: "Select a valid traceability relationship." };
      }

      traceLinks.push(result.traceLink);

      return {
        ok: true,
        traceLink: toTraceLinkSummary(result.traceLink, source, target)
      };
    },

    createAcceptanceCriteria(projectId, requirementObjectId, input, actor) {
      const requirement = findDraft(projectId, requirementObjectId)?.decisionObject;
      const result = buildAcceptanceCriteriaCreate(requirement, input, actor, {
        idGenerator: (kind) => {
          draftIdSequence += 1;
          return `local-${kind}-${draftIdSequence}`;
        }
      });

      if (!result.ok) {
        return { ok: false, error: "Add at least one acceptance criterion to a requirement." };
      }

      decisionObjects.push(result.decisionObject);
      decisionObjectVersions.push(result.version);
      traceLinks.push(result.traceLink);

      return {
        ok: true,
        acceptanceCriteria: toAcceptanceCriteriaSummary(
          result.decisionObject,
          result.version,
          result.traceLink
        ),
        traceLink: toTraceLinkSummary(result.traceLink, requirement, result.decisionObject)
      };
    },

    deleteTraceLink(projectId, objectId, linkId) {
      const index = traceLinks.findIndex(
        (traceLink) =>
          traceLink.project_id === projectId &&
          traceLink.link_id === linkId &&
          (traceLink.source_object_id === objectId ||
            traceLink.target_object_id === objectId)
      );

      if (index === -1) {
        return { ok: false, error: "Trace link was not found." };
      }

      traceLinks.splice(index, 1);

      return { ok: true };
    },

    acceptDraft(projectId, objectId, actor) {
      const draft = findDraft(projectId, objectId);

      if (!draft) {
        return { ok: false, error: "Draft object was not found." };
      }

      const update = acceptDecisionDraft(draft.decisionObject, draft.version, actor);

      if (!update.ok) {
        return { ok: false, error: "Draft could not be accepted." };
      }

      return {
        ok: true,
        decisionObject: persistDraftUpdate(update)
      };
    },

    rejectDraft(projectId, objectId, actor) {
      const draft = findDraft(projectId, objectId);

      if (!draft) {
        return { ok: false, error: "Draft object was not found." };
      }

      const update = rejectDecisionDraft(draft.decisionObject, draft.version, actor);

      if (!update.ok) {
        return { ok: false, error: "Draft could not be rejected." };
      }

      return {
        ok: true,
        decisionObject: persistDraftUpdate(update),
        excludedFromReadiness: isRejectedDecisionDraft(update.decisionObject, update.version)
      };
    },

    submitApproval(projectId, objectId, input, actor) {
      const draft = findDraft(projectId, objectId);

      if (!draft) {
        return { ok: false, error: "Decision object was not found." };
      }

      const result = buildApprovalDecision(draft.decisionObject, draft.version, input, actor, {
        idGenerator: (kind) => {
          draftIdSequence += 1;
          return `local-${kind}-${draftIdSequence}`;
        }
      });

      if (!result.ok) {
        return {
          ok: false,
          error: result.validation.errors.includes("APPROVAL_COMMENT_REQUIRED")
            ? "Reject and request-changes decisions require a comment."
            : "You do not have approval authority for this item."
        };
      }

      approvals.push(result.approval);
      auditEvents.push(
        buildApprovalAuditEvent(result.approval, result.decisionObject, actor, {
          idGenerator: (kind) => {
            draftIdSequence += 1;
            return `local-${kind}-${draftIdSequence}`;
          }
        })
      );

      return {
        ok: true,
        approval: toApprovalSummary(result.approval, result.decisionObject, draft.version),
        decisionObject: persistDraftUpdate({
          decisionObject: result.decisionObject,
          version: draft.version
        })
      };
    },

    submitOverride(projectId, input, actor) {
      const project = projectService
        .listProjects()
        .find((candidate) => candidate.projectId === projectId);

      if (!project) {
        return { ok: false, error: "Project was not found." };
      }

      const projectDecisionObjects = decisionObjects.filter(
        (decisionObject) => decisionObject.project_id === projectId
      );
      const projectDecisionObjectIds = new Set(
        projectDecisionObjects.map((decisionObject) => decisionObject.object_id)
      );
      const readiness = evaluateProjectReadiness(toProjectRecord(project), {
        decisionObjects: projectDecisionObjects,
        decisionObjectVersions: decisionObjectVersions.filter((version) =>
          projectDecisionObjectIds.has(version.object_id)
        ),
        traceLinks: traceLinks.filter((traceLink) => traceLink.project_id === projectId),
        approvals: approvals.filter((approval) => projectDecisionObjectIds.has(approval.object_id)),
        overrides: overrides.filter((override) => override.project_id === projectId)
      });
      const result = buildOverrideRecord(
        toProjectRecord(project),
        readiness.blockers,
        input,
        actor,
        {
          idGenerator: (kind) => {
            draftIdSequence += 1;
            return `local-${kind}-${draftIdSequence}`;
          }
        }
      );

      if (!result.ok) {
        return {
          ok: false,
          error: "Select open blockers and provide both a reason and risk acknowledgment."
        };
      }

      overrides.push(result.override);
      auditEvents.push(
        buildOverrideAuditEvent(result.override, actor, {
          idGenerator: (kind) => {
            draftIdSequence += 1;
            return `local-${kind}-${draftIdSequence}`;
          }
        })
      );

      return {
        ok: true,
        override: toOverrideSummary(result.override),
        readiness: getReadinessDashboard(projectId)
      };
    },

    async generateDraft(projectId, actor) {
      const project = projectService
        .listProjects()
        .find((candidate) => candidate.projectId === projectId);
      const documents = documentService.listDocuments(projectId).map(toDocumentRecord);
      const jobResult = buildQueuedAiGenerationJob(
        {
          projectId,
          documents
        },
        actor,
        {
          idGenerator: () => `local-ai-job-${jobs.length + 1}`
        }
      );

      if (!project || !jobResult.ok) {
        return {
          ok: false,
          error: "Upload at least one document before AI draft generation."
        };
      }

      jobs.push(markAiGenerationJobRunning(jobResult.job));
      const runningJob = jobs.at(-1);

      try {
        const output = await aiDraftAdapter.generateDraft({
          project: toProjectRecord(project),
          documents
        });
        const normalized = normalizeAiDraftOutput(output, runningJob, AI_SYSTEM_ACTOR, {
          idGenerator: () => {
            draftIdSequence += 1;
            return `local-ai-${draftIdSequence}`;
          }
        });

        if (!normalized.ok) {
          throw new Error(normalized.validation.errors.join(", "));
        }

        decisionObjects.push(...normalized.decisionObjects);
        decisionObjectVersions.push(...normalized.decisionObjectVersions);

        const workflowByTitle = new Map(
          normalized.decisionObjects
            .filter((decisionObject) => decisionObject.type === DECISION_OBJECT_TYPES.WORKFLOW)
            .map((workflow) => [workflow.title, workflow])
        );
        const requirementByTitle = new Map(
          normalized.decisionObjects
            .filter((decisionObject) => decisionObject.type === DECISION_OBJECT_TYPES.REQUIREMENT)
            .map((requirement) => [requirement.title, requirement])
        );

        for (const version of normalized.decisionObjectVersions) {
          const decisionObject = normalized.decisionObjects.find(
            (candidate) => candidate.object_id === version.object_id
          );

          if (!decisionObject || decisionObject.type !== DECISION_OBJECT_TYPES.REQUIREMENT) {
            continue;
          }

          const workflowTitle = version?.content?.derived_from_workflow_title;
          const workflow = workflowByTitle.get(workflowTitle);

          if (!workflow) {
            continue;
          }

          const link = buildTraceLinkCreate(
            decisionObject,
            workflow,
            { relationshipType: TRACE_RELATIONSHIP_TYPES.DERIVED_FROM },
            actor,
            {
              idGenerator: (kind) => {
                draftIdSequence += 1;
                return `local-${kind}-${draftIdSequence}`;
              }
            }
          );

          if (link.ok) {
            traceLinks.push(link.traceLink);
          }
        }

        for (const version of normalized.decisionObjectVersions) {
          const decisionObject = normalized.decisionObjects.find(
            (candidate) => candidate.object_id === version.object_id
          );

          if (!decisionObject || decisionObject.type !== DECISION_OBJECT_TYPES.TEST) {
            continue;
          }

          const requirementTitle = version?.content?.validates_requirement_title;
          const requirement = requirementByTitle.get(requirementTitle);

          if (!requirement) {
            continue;
          }

          const link = buildTraceLinkCreate(
            requirement,
            decisionObject,
            { relationshipType: TRACE_RELATIONSHIP_TYPES.VALIDATED_BY },
            actor,
            {
              idGenerator: (kind) => {
                draftIdSequence += 1;
                return `local-${kind}-${draftIdSequence}`;
              }
            }
          );

          if (link.ok) {
            traceLinks.push(link.traceLink);
          }
        }

        const completed = markAiGenerationJobCompleted(runningJob);
        jobs[jobs.length - 1] = completed;
        auditEvents.push(
          buildAiGenerationAuditEvent(completed, AI_SYSTEM_ACTOR, {
            generated_decision_object_count: normalized.decisionObjects.length
          })
        );

        return {
          ok: true,
          job: toAiGenerationJobSummary(completed),
          decisionObjects: listDecisionObjects(projectId)
        };
      } catch (error) {
        const failed = markAiGenerationJobFailed(runningJob, error.message);
        jobs[jobs.length - 1] = failed;
        auditEvents.push(
          buildAiGenerationAuditEvent(failed, AI_SYSTEM_ACTOR, {
            error_message: failed.error_message
          })
        );

        return {
          ok: false,
          job: toAiGenerationJobSummary(failed),
          error: "AI draft generation failed. Uploaded documents remain available."
        };
      }
    },

    listAuditEvents(projectId) {
      if (!projectId) {
        return [...auditEvents];
      }

      return auditEvents
        .filter((event) => event.project_id === projectId)
        .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
        .map(toAuditEventSummary);
    }
  });
}

function renderProjectIntake(container, projectService, currentUser, onSelectProject) {
  container.innerHTML = "";

  const heading = document.createElement("h2");
  heading.textContent = "Project Intake";
  container.append(heading);

  if (currentUser.canManageProject) {
    const form = document.createElement("form");
    form.className = "project-form";

    const nameInput = createInput("Project name", "name", true);
    const customerInput = createInput("Customer", "customer");
    const contractInput = createInput("Contract number", "contractNumber");
    const programInput = createInput("Program", "programName");
    const descriptionInput = createInput("Description", "description");
    const error = document.createElement("p");
    error.className = "form-error";
    error.setAttribute("role", "alert");

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "Create Project";

    form.append(nameInput, customerInput, contractInput, programInput, descriptionInput, error, submit);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const name = String(formData.get("name") ?? "").trim();

      if (!name) {
        error.textContent = "Project name is required.";
        return;
      }

      error.textContent = "";
      const project = projectService.createProject(
        {
          name,
          customer: String(formData.get("customer") ?? ""),
          contractNumber: String(formData.get("contractNumber") ?? ""),
          programName: String(formData.get("programName") ?? ""),
          description: String(formData.get("description") ?? "")
        },
        currentUser.actor
      );
      form.reset();
      renderProjectIntake(container, projectService, currentUser, onSelectProject);
      onSelectProject(project);
    });

    container.append(form);
  }

  const list = document.createElement("div");
  list.className = "project-cards";

  for (const project of projectService.listProjects()) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "project-card";
    button.addEventListener("click", () => onSelectProject(project));

    const name = document.createElement("strong");
    name.textContent = project.name;
    const meta = document.createElement("span");
    meta.textContent = `${formatStatus(project.status)} | ${formatStatus(project.readinessStatus)}`;

    button.append(name, meta);
    list.append(button);
  }

  container.append(list);
}

function renderProjectWorkspace(
  container,
  project,
  currentUser,
  documentService,
  aiGenerationService,
  selectedObjectId = null
) {
  container.innerHTML = "";

  if (!project) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No projects yet.";
    container.append(empty);
    return;
  }

  const heading = document.createElement("h2");
  heading.textContent = project.name ?? "Plan workspace";

  const helper = document.createElement("p");
  helper.className = "summary";
  helper.textContent =
    "Step 1: Upload documents. Step 2: Generate Plan. Step 3: Edit. Step 4: Export to Jira.";

  const documentPanel = renderDocumentInventory(project, currentUser, documentService, () => {
    renderProjectWorkspace(
      container,
      project,
      currentUser,
      documentService,
      aiGenerationService,
      selectedObjectId
    );
  });
  const planPanel = renderAiGenerationPanel(
    project,
    currentUser,
    documentService,
    aiGenerationService,
    () => {
      renderProjectWorkspace(
        container,
        project,
        currentUser,
        documentService,
        aiGenerationService,
        selectedObjectId
      );
    },
    selectedObjectId
  );
  const jiraExportPanel = renderJiraExportPanel(project, currentUser, aiGenerationService, () => {
    renderProjectWorkspace(
      container,
      project,
      currentUser,
      documentService,
      aiGenerationService,
      selectedObjectId
    );
  });

  container.append(
    heading,
    helper,
    planPanel,
    jiraExportPanel,
    documentPanel
  );
}

function createInput(label, name, required = false) {
  const field = document.createElement("label");
  field.textContent = label;
  const input = document.createElement("input");
  input.name = name;
  input.required = required;
  field.append(input);
  return field;
}

function formatStatus(status) {
  return String(status)
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function formatDateTime(value) {
  if (!value) {
    return "Unknown time";
  }

  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function renderDocumentInventory(project, currentUser, documentService, onChange) {
  const panel = document.createElement("section");
  panel.className = "document-panel";
  panel.setAttribute("aria-label", "Document inventory");

  const header = document.createElement("div");
  header.className = "panel-header";

  const heading = document.createElement("h3");
  heading.textContent = "Documents";

  const generateButton = document.createElement("button");
  generateButton.type = "button";
  generateButton.className = "secondary-action";
  generateButton.textContent = "Generate AI Draft";

  const documents = documentService.listDocuments(project.projectId);
  generateButton.disabled = documents.length === 0;

  header.append(heading, generateButton);
  panel.append(header);

  if (currentUser.canManageProject) {
    const form = document.createElement("form");
    form.className = "document-form";

    const input = document.createElement("input");
    input.type = "file";
    input.name = "documents";
    input.multiple = true;
    input.accept = ".pdf,.docx,.txt";

    const error = document.createElement("p");
    error.className = "form-error";
    error.setAttribute("role", "alert");

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = "Upload Documents";

    form.append(input, error, submit);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const result = documentService.uploadDocuments(project.projectId, input.files, currentUser.actor);

      if (result.errors.length > 0) {
        error.textContent = result.errors.join(". ");
      }

      if (result.uploaded.length > 0) {
        form.reset();
        onChange();
      }
    });

    panel.append(form);
  }

  if (documents.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Upload at least one document before AI draft generation.";
    panel.append(empty);
    return panel;
  }

  const list = document.createElement("ul");
  list.className = "document-list";

  for (const documentRecord of documents) {
    const item = document.createElement("li");
    const name = document.createElement("strong");
    name.textContent = documentRecord.fileName;
    const meta = document.createElement("span");
    meta.textContent = `${formatStatus(documentRecord.documentType)} | ${formatStatus(
      documentRecord.uploadStatus ?? DOCUMENT_UPLOAD_STATUSES.UPLOADED
    )}`;
    item.append(name, meta);
    list.append(item);
  }

  panel.append(list);
  return panel;
}

function renderAiGenerationPanel(
  project,
  currentUser,
  documentService,
  aiGenerationService,
  onChange,
  selectedObjectId = null
) {
  const panel = document.createElement("section");
  panel.className = "ai-panel";
  panel.setAttribute("aria-label", "Plan generation");

  const header = document.createElement("div");
  header.className = "panel-header";

  const heading = document.createElement("h3");
  heading.textContent = "Generate Plan";

  const status = document.createElement("p");
  status.className = "draft-status";
  status.setAttribute("role", "status");

  const generateButton = document.createElement("button");
  generateButton.type = "button";
  generateButton.className = "primary-action";
  generateButton.textContent = "Generate Plan";

  const documents = documentService.listDocuments(project.projectId);
  const drafts = aiGenerationService.listDecisionObjects(project.projectId);
  generateButton.disabled = documents.length === 0 || !currentUser.canGenerateAiDraft;

  generateButton.addEventListener("click", async () => {
    generateButton.disabled = true;
    status.textContent = "Generation running.";
    const result = await aiGenerationService.generateDraft(project.projectId, currentUser.actor);

    status.textContent = result.ok
      ? `Generation completed with ${result.decisionObjects.length} draft objects.`
      : result.error;
    onChange();
  });

  header.append(heading, generateButton);
  panel.append(header, status);

  if (documents.length === 0 && drafts.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Upload a SOW to enable plan generation.";
    panel.append(empty);
    return panel;
  }

  if (drafts.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state neutral";
    empty.textContent = "No plan generated yet.";
    panel.append(empty);
    return panel;
  }

  const plan = aiGenerationService.getGeneratedPlan(project.projectId);
  if (plan) {
    panel.append(renderPlanSummaryView(plan));
    panel.append(renderPlanEditorView(project, currentUser, aiGenerationService, plan, onChange));
  }

  const advanced = document.createElement("details");
  advanced.className = "advanced-panel";
  const summary = document.createElement("summary");
  summary.textContent = "Advanced (draft objects, traceability, approvals)";
  advanced.append(summary);
  advanced.append(
    renderDraftReviewWorkspace(
      project,
      currentUser,
      aiGenerationService,
      drafts,
      onChange,
      selectedObjectId
    )
  );
  panel.append(advanced);
  return panel;
}

function renderPlanSummaryView(plan) {
  const section = document.createElement("section");
  section.className = "plan-summary";
  section.setAttribute("aria-label", "Plan summary");

  const heading = document.createElement("h4");
  heading.textContent = "Plan Summary";

  const layout = document.createElement("div");
  layout.className = "plan-summary-grid";

  const workflowCard = document.createElement("section");
  workflowCard.className = "plan-card";
  const workflowHeading = document.createElement("h5");
  workflowHeading.textContent = `Workflows (${plan.workflows.length})`;
  workflowCard.append(workflowHeading);
  workflowCard.append(renderSimpleList(plan.workflows.map((workflow) => workflow.title)));

  const requirementCard = document.createElement("section");
  requirementCard.className = "plan-card";
  const requirementHeading = document.createElement("h5");
  requirementHeading.textContent = `Requirements (${plan.requirements.length})`;
  requirementCard.append(requirementHeading);
  requirementCard.append(renderRequirementsGroupedByWorkflow(plan));

  const riskCard = document.createElement("section");
  riskCard.className = "plan-card";
  const riskHeading = document.createElement("h5");
  riskHeading.textContent = `Risks (${plan.risks.length})`;
  riskCard.append(riskHeading);
  riskCard.append(renderSimpleList(plan.risks.map((risk) => risk.title)));

  const missingCard = document.createElement("section");
  missingCard.className = "plan-card";
  const missingHeading = document.createElement("h5");
  missingHeading.textContent = "Missing information";
  missingCard.append(missingHeading);
  if (!Array.isArray(plan.missingInformation) || plan.missingInformation.length === 0) {
    const ok = document.createElement("p");
    ok.className = "empty-state neutral";
    ok.textContent = "No obvious gaps detected.";
    missingCard.append(ok);
  } else {
    const list = document.createElement("ul");
    list.className = "missing-info-list";
    for (const item of plan.missingInformation) {
      const row = document.createElement("li");
      const question = document.createElement("strong");
      question.textContent = item.question;
      const reason = document.createElement("span");
      reason.textContent = item.reason;
      row.append(question, reason);
      list.append(row);
    }
    missingCard.append(list);
  }

  layout.append(workflowCard, requirementCard, riskCard, missingCard);
  section.append(heading, layout);
  return section;
}

function renderRequirementsGroupedByWorkflow(plan) {
  const workflowTitleById = new Map(plan.workflows.map((workflow) => [workflow.workflowId, workflow.title]));
  const groups = new Map();

  for (const requirement of plan.requirements) {
    const workflowIds = Array.isArray(requirement.workflowIds) && requirement.workflowIds.length > 0 ? requirement.workflowIds : ["__unlinked__"];
    for (const workflowId of workflowIds) {
      const group = groups.get(workflowId) ?? [];
      group.push(requirement);
      groups.set(workflowId, group);
    }
  }

  if (groups.size === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state neutral";
    empty.textContent = "No requirements yet.";
    return empty;
  }

  const container = document.createElement("div");
  container.className = "requirements-groups";

  for (const [workflowId, requirements] of groups.entries()) {
    const group = document.createElement("section");
    group.className = "requirements-group";
    const heading = document.createElement("h6");
    heading.textContent =
      workflowId === "__unlinked__" ? "Unlinked requirements" : workflowTitleById.get(workflowId) ?? workflowId;
    const list = document.createElement("ul");
    list.className = "requirements-list";
    for (const requirement of requirements.slice(0, 6)) {
      const item = document.createElement("li");
      item.textContent = requirement.title;
      list.append(item);
    }
    if (requirements.length > 6) {
      const more = document.createElement("p");
      more.className = "empty-state neutral";
      more.textContent = `+${requirements.length - 6} more`;
      group.append(heading, list, more);
    } else {
      group.append(heading, list);
    }
    container.append(group);
  }

  return container;
}

function renderSimpleList(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state neutral";
    empty.textContent = "None yet.";
    return empty;
  }

  const list = document.createElement("ul");
  list.className = "simple-list";
  for (const value of items.slice(0, 10)) {
    const item = document.createElement("li");
    item.textContent = value;
    list.append(item);
  }
  return list;
}

function renderPlanEditorView(project, currentUser, aiGenerationService, plan, onChange) {
  const section = document.createElement("section");
  section.className = "plan-editor";
  section.setAttribute("aria-label", "Edit plan");

  const heading = document.createElement("h4");
  heading.textContent = "Edit Plan";

  const hint = document.createElement("p");
  hint.className = "empty-state neutral";
  hint.textContent = "Edits update the underlying draft objects (approvals/readiness still exist under Advanced).";

  const drafts = aiGenerationService.listDecisionObjects(project.projectId);
  const draftById = new Map(drafts.map((draft) => [draft.objectId, draft]));

  const content = document.createElement("div");
  content.className = "plan-editor-grid";

  content.append(
    renderPlanEditorSection(
      "Workflows",
      plan.workflows.map((workflow) => ({
        id: workflow.workflowId,
        type: "workflow",
        title: workflow.title,
        text: workflow.summary
      })),
      draftById,
      aiGenerationService,
      project,
      currentUser,
      onChange
    )
  );

  content.append(
    renderPlanEditorSection(
      "Requirements",
      plan.requirements.map((requirement) => ({
        id: requirement.requirementId,
        type: "requirement",
        title: requirement.title,
        text: requirement.statement,
        acceptanceCriteria: requirement.acceptanceCriteria
      })),
      draftById,
      aiGenerationService,
      project,
      currentUser,
      onChange
    )
  );

  content.append(
    renderPlanEditorSection(
      "Risks",
      plan.risks.map((risk) => ({
        id: risk.riskId,
        type: "risk",
        title: risk.title,
        text: `${risk.description}${risk.mitigation ? `\\n\\nMitigation: ${risk.mitigation}` : ""}`
      })),
      draftById,
      aiGenerationService,
      project,
      currentUser,
      onChange
    )
  );

  section.append(heading, hint, content);
  return section;
}

function renderPlanEditorSection(
  label,
  items,
  draftById,
  aiGenerationService,
  project,
  currentUser,
  onChange
) {
  const section = document.createElement("section");
  section.className = "plan-editor-section";
  const heading = document.createElement("h5");
  heading.textContent = label;
  section.append(heading);

  if (!Array.isArray(items) || items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state neutral";
    empty.textContent = `No ${label.toLowerCase()} yet.`;
    section.append(empty);
    return section;
  }

  for (const item of items) {
    const draft = draftById.get(item.id);
    if (!draft) {
      continue;
    }

    const card = document.createElement("form");
    card.className = "plan-edit-card";

    const titleLabel = document.createElement("label");
    titleLabel.textContent = "Title";
    const titleInput = document.createElement("input");
    titleInput.value = draft.title ?? item.title ?? "";
    titleLabel.append(titleInput);

    const contentLabel = document.createElement("label");
    contentLabel.textContent = label === "Requirements" ? "Requirement" : "Content";
    const contentArea = document.createElement("textarea");
    contentArea.rows = 5;
    contentArea.value = item.text ?? "";
    contentLabel.append(contentArea);

    const footer = document.createElement("div");
    footer.className = "plan-edit-actions";
    const save = document.createElement("button");
    save.type = "submit";
    save.className = "secondary-action";
    save.textContent = "Save";
    save.disabled = !currentUser.canManageProject;

    const status = document.createElement("span");
    status.className = "plan-edit-status";

    footer.append(save, status);

    card.append(titleLabel, contentLabel);

    let criteriaArea = null;
    if (label === "Requirements" && Array.isArray(item.acceptanceCriteria)) {
      const criteriaLabel = document.createElement("label");
      criteriaLabel.textContent = "Acceptance Criteria (one per line)";
      criteriaArea = document.createElement("textarea");
      criteriaArea.rows = 4;
      criteriaArea.value = item.acceptanceCriteria.join("\n");
      criteriaLabel.append(criteriaArea);
      card.append(criteriaLabel);
    }

    card.addEventListener("submit", (event) => {
      event.preventDefault();
      status.textContent = "";

      const nextTitle = titleInput.value.trim();
      const nextText = contentArea.value;
      const baseContent = editableTextToDraftContent({ type: item.type }, nextText);
      const nextContent =
        criteriaArea
          ? {
              ...baseContent,
              acceptance_criteria: criteriaArea.value
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean)
            }
          : baseContent;

      const result = aiGenerationService.updateDraft(
        project.projectId,
        item.id,
        {
          title: nextTitle,
          content: nextContent,
          changeReason: "Edited from plan view."
        },
        currentUser.actor
      );

      if (!result.ok) {
        status.textContent = result.error ?? "Save failed.";
        return;
      }

      status.textContent = "Saved.";
      onChange();
    });

    card.append(footer);
    section.append(card);
  }

  return section;
}

function renderReadinessDashboard(
  project,
  currentUser,
  aiGenerationService,
  onOpenObject,
  onChange
) {
  const dashboard = aiGenerationService.getReadinessDashboard(project.projectId);
  const panel = document.createElement("section");
  panel.className = "readiness-dashboard";
  panel.setAttribute("aria-label", "Readiness dashboard");

  if (!dashboard) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Readiness is unavailable for this project.";
    panel.append(empty);
    return panel;
  }

  const header = document.createElement("div");
  header.className = `readiness-hero ${
    dashboard.status === READINESS_STATUSES.READY ? "ready" : "not-ready"
  }`;
  const statusGroup = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "readiness-eyebrow";
  eyebrow.textContent = "Readiness Gate";
  const title = document.createElement("h3");
  title.textContent = formatStatus(dashboard.status);
  const summary = document.createElement("p");
  summary.className = "approval-preview";
  summary.textContent = dashboard.summary;
  statusGroup.append(eyebrow, title, summary);

  const scoreButton = document.createElement("button");
  scoreButton.type = "button";
  scoreButton.className = "readiness-score";
  scoreButton.setAttribute("aria-expanded", "false");
  scoreButton.textContent = `${dashboard.readinessScore}%`;
  header.append(statusGroup, scoreButton);

  const breakdown = document.createElement("dl");
  breakdown.className = "score-breakdown";
  breakdown.hidden = true;
  for (const [label, value] of [
    ["Open hard blockers", dashboard.scoreBreakdown.hardBlockers],
    ["Resolved or overridden blockers", dashboard.scoreBreakdown.resolvedBlockers],
    ["Warnings", dashboard.scoreBreakdown.warnings],
    ["Rule set", dashboard.scoreBreakdown.ruleSetVersion]
  ]) {
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = String(value);
    breakdown.append(term, description);
  }
  scoreButton.addEventListener("click", () => {
    breakdown.hidden = !breakdown.hidden;
    scoreButton.setAttribute("aria-expanded", String(!breakdown.hidden));
  });

  const stats = document.createElement("div");
  stats.className = "dashboard-stats";
  for (const [label, value] of [
    ["Hard blockers", dashboard.hardBlockers.length],
    ["Pending approvals", dashboard.pendingApprovalCount],
    ["Open risks", dashboard.openRiskCount],
    ["Overrides", dashboard.overrideCount]
  ]) {
    const stat = document.createElement("div");
    stat.className = "dashboard-stat";
    const valueNode = document.createElement("strong");
    valueNode.textContent = String(value);
    const labelNode = document.createElement("span");
    labelNode.textContent = label;
    stat.append(valueNode, labelNode);
    stats.append(stat);
  }

  const blockerSection = document.createElement("section");
  blockerSection.className = "dashboard-section";
  const blockerHeading = document.createElement("h4");
  blockerHeading.textContent = "Active Hard Blockers";
  blockerSection.append(blockerHeading);

  if (dashboard.hardBlockers.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state neutral";
    empty.textContent = "No active blockers. The project may be eligible for Ready-to-Build certification.";
    blockerSection.append(empty);
  } else {
    const blockerList = document.createElement("ul");
    blockerList.className = "blocker-list";
    for (const blocker of dashboard.hardBlockers) {
      blockerList.append(renderBlockerItem(blocker, onOpenObject));
    }
    blockerSection.append(blockerList);
  }

  const overrideSection = document.createElement("section");
  overrideSection.className = "dashboard-section override-summary";
  const overrideHeading = document.createElement("h4");
  overrideHeading.textContent = "Overrides";
  overrideSection.append(overrideHeading);
  if (dashboard.overrides.length === 0 && dashboard.resolvedBlockers.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state neutral";
    empty.textContent = "No overrides have been recorded.";
    overrideSection.append(empty);
  } else {
    const overrideList = document.createElement("ul");
    overrideList.className = "override-list";
    for (const override of dashboard.overrides) {
      const item = document.createElement("li");
      item.textContent = `${formatOwner(
        override.authorizedBy,
        aiGenerationService.listAssignableOwners()
      )}: ${override.reason}`;
      overrideList.append(item);
    }
    for (const blocker of dashboard.resolvedBlockers.filter(
      (candidate) => candidate.status === BLOCKER_STATUSES.OVERRIDDEN
    )) {
      const item = document.createElement("li");
      item.textContent = `${blocker.description} (${formatStatus(blocker.status)})`;
      overrideList.append(item);
    }
    overrideSection.append(overrideList);
  }

  if (currentUser.canSubmitOverride && dashboard.hardBlockers.length > 0) {
    overrideSection.append(
      renderOverrideForm(project, dashboard.hardBlockers, currentUser, aiGenerationService, onChange)
    );
  }

  const exportSection = document.createElement("section");
  exportSection.className = "dashboard-section export-gate";
  const exportHeading = document.createElement("h4");
  exportHeading.textContent = "Certification and Jira Export";
  const exportAction = document.createElement("button");
  exportAction.type = "button";
  exportAction.className = "secondary-action";
  exportAction.textContent = "Jira Export";
  exportAction.disabled =
    dashboard.jiraExportDisabled || !currentUser.canExportToJira;
  const exportMessage = document.createElement("p");
  exportMessage.className = "approval-preview";
  exportMessage.textContent = dashboard.jiraExportDisabled
    ? "Jira export is blocked until the readiness gate is open or a valid override state permits export."
    : "Jira export is available for authorized users.";
  exportSection.append(exportHeading, exportMessage, exportAction);

  const auditSection = renderAuditActivityPanel(
    aiGenerationService.listAuditEvents(project.projectId)
  );

  panel.append(
    header,
    breakdown,
    stats,
    blockerSection,
    overrideSection,
    exportSection,
    auditSection
  );
  return panel;
}

function renderAuditActivityPanel(auditEvents) {
  const section = document.createElement("section");
  section.className = "dashboard-section audit-activity";
  section.setAttribute("aria-label", "Audit activity");

  const heading = document.createElement("h4");
  heading.textContent = "Audit Activity";
  section.append(heading);

  if (auditEvents.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state neutral";
    empty.textContent = "No audit events have been recorded for this project.";
    section.append(empty);
    return section;
  }

  const list = document.createElement("ol");
  list.className = "audit-list";

  for (const event of auditEvents.slice(0, 6)) {
    const item = document.createElement("li");
    const label = document.createElement("strong");
    label.textContent = `${formatStatus(event.eventType)} ${formatStatus(event.entityType)}`;
    const meta = document.createElement("span");
    meta.textContent = `${formatOwner(event.actorId, SEEDED_MVP_USERS)} - ${formatDateTime(
      event.timestamp
    )}`;
    item.append(label, meta);
    list.append(item);
  }

  section.append(list);
  return section;
}

function renderOverrideForm(project, blockers, currentUser, aiGenerationService, onChange) {
  const form = document.createElement("form");
  form.className = "override-form";

  const heading = document.createElement("h5");
  heading.textContent = "Risk Acceptance";

  const blockerGroup = document.createElement("fieldset");
  const blockerLegend = document.createElement("legend");
  blockerLegend.textContent = "Blockers";
  blockerGroup.append(blockerLegend);
  for (const blocker of blockers) {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "blockerIds";
    checkbox.value = blocker.blockerId;
    checkbox.checked = true;
    const text = document.createElement("span");
    text.textContent = blocker.description;
    label.append(checkbox, text);
    blockerGroup.append(label);
  }

  const reasonField = document.createElement("label");
  reasonField.textContent = "Reason";
  const reason = document.createElement("textarea");
  reason.name = "reason";
  reason.required = true;
  reason.rows = 3;
  reasonField.append(reason);

  const riskField = document.createElement("label");
  riskField.textContent = "Risk acknowledgment";
  const riskAcknowledgment = document.createElement("textarea");
  riskAcknowledgment.name = "riskAcknowledgment";
  riskAcknowledgment.required = true;
  riskAcknowledgment.rows = 3;
  riskField.append(riskAcknowledgment);

  const authorityField = document.createElement("label");
  authorityField.className = "checkbox-field";
  const authority = document.createElement("input");
  authority.type = "checkbox";
  authority.name = "authorityConfirmed";
  authority.required = true;
  const authorityText = document.createElement("span");
  authorityText.textContent = `I am submitting as ${currentUser.actor.roleLabel}.`;
  authorityField.append(authority, authorityText);

  const error = document.createElement("p");
  error.className = "form-error";
  error.setAttribute("role", "alert");

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "secondary-action";
  submit.textContent = "Submit Override";

  form.append(heading, blockerGroup, reasonField, riskField, authorityField, error, submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const blockerIds = formData.getAll("blockerIds").map(String);

    if (!formData.get("authorityConfirmed")) {
      error.textContent = "Confirm override authority before submitting.";
      return;
    }

    const result = aiGenerationService.submitOverride(
      project.projectId,
      {
        blockerIds,
        reason: String(formData.get("reason") ?? ""),
        riskAcknowledgment: String(formData.get("riskAcknowledgment") ?? "")
      },
      currentUser.actor
    );

    if (!result.ok) {
      error.textContent = result.error;
      return;
    }

    form.reset();
    onChange?.();
  });

  return form;
}

function renderCertificationPackagePanel(project, currentUser, aiGenerationService, onChange) {
  const panel = document.createElement("section");
  panel.className = "certification-panel";
  panel.setAttribute("aria-label", "Certification package preview");

  const dashboard = aiGenerationService.getReadinessDashboard(project.projectId);
  const packages = aiGenerationService.listCertificationPackages(project.projectId);
  const latestPackage = packages.at(-1);

  const header = document.createElement("div");
  header.className = "panel-header";
  const heading = document.createElement("h3");
  heading.textContent = "Certification Package";
  const generateButton = document.createElement("button");
  generateButton.type = "button";
  generateButton.className = "secondary-action";
  generateButton.textContent = "Generate Package";
  generateButton.disabled =
    !currentUser.canExportToJira || dashboard?.status !== READINESS_STATUSES.READY;
  header.append(heading, generateButton);

  const status = document.createElement("p");
  status.className = "approval-preview";
  status.setAttribute("role", "status");
  status.textContent =
    dashboard?.status === READINESS_STATUSES.READY
      ? "Ready-to-Build package preview can be generated for the current baseline."
      : "Package generation is blocked until readiness is Ready or accepted risk opens the gate.";

  const checklist = document.createElement("ul");
  checklist.className = "package-checklist";
  for (const [label, enabled] of [
    ["Versioned decision objects", true],
    ["Traceability matrix", latestPackage?.includesTraceabilityMatrix ?? true],
    ["Approval records", latestPackage?.includesApprovals ?? true],
    ["Risks", latestPackage?.includesRisks ?? true],
    ["Override log", latestPackage?.includesOverrides ?? true]
  ]) {
    const item = document.createElement("li");
    item.textContent = `${label}: ${enabled ? "Included" : "Excluded"}`;
    checklist.append(item);
  }

  const preview = document.createElement("div");
  preview.className = "package-preview";
  if (latestPackage) {
    const title = document.createElement("strong");
    title.textContent = `${formatStatus(latestPackage.status)} package`;
    const details = document.createElement("p");
    details.textContent = `${latestPackage.packageId} generated ${latestPackage.generatedAt}.`;
    const uri = document.createElement("span");
    uri.textContent = latestPackage.packageUri;
    preview.append(title, details, uri);
  } else {
    const empty = document.createElement("p");
    empty.className = "empty-state neutral";
    empty.textContent = "No package preview has been generated.";
    preview.append(empty);
  }

  const error = document.createElement("p");
  error.className = "form-error";
  error.setAttribute("role", "alert");

  generateButton.addEventListener("click", () => {
    const result = aiGenerationService.generateCertificationPackage(
      project.projectId,
      {
        includeTraceabilityMatrix: true,
        includeApprovals: true,
        includeRisks: true,
        includeOverrides: true
      },
      currentUser.actor
    );

    if (!result.ok) {
      error.textContent = result.error;
      return;
    }

    onChange?.();
  });

  panel.append(header, status, checklist, preview, error);
  return panel;
}

function renderJiraExportPanel(project, currentUser, aiGenerationService, onChange) {
  const panel = document.createElement("section");
  panel.className = "jira-export-panel";
  panel.setAttribute("aria-label", "Jira export");

  const dashboard = aiGenerationService.getReadinessDashboard(project.projectId);
  const exportJobs = aiGenerationService.listJiraExports(project.projectId);
  const latestJob = exportJobs.at(-1);

  const header = document.createElement("div");
  header.className = "panel-header";
  const heading = document.createElement("h3");
  heading.textContent = "Jira Export";
  const status = document.createElement("p");
  status.className = "draft-status";
  status.textContent = latestJob
    ? `${formatStatus(latestJob.status)} export ${latestJob.exportJobId}`
    : "No Jira export has been submitted.";
  header.append(heading, status);

  const gateMessage = document.createElement("p");
  gateMessage.className = "approval-preview";
  gateMessage.textContent =
    "Export Jira-ready tickets (epics = workflows, stories = requirements). Readiness gating is available under Advanced, but export is enabled for fast MVP demos.";

  const form = document.createElement("form");
  form.className = "jira-export-form";
  const keyField = createInput("Jira project key", "jiraProjectKey", true);
  keyField.querySelector("input").value = latestJob?.jiraProjectKey ?? "APOLLO";

  const traceabilityField = document.createElement("label");
  traceabilityField.className = "checkbox-field";
  const traceability = document.createElement("input");
  traceability.type = "checkbox";
  traceability.name = "includeTraceabilityLinks";
  traceability.checked = true;
  const traceabilityText = document.createElement("span");
  traceabilityText.textContent = "Include traceability metadata";
  traceabilityField.append(traceability, traceabilityText);

  const error = document.createElement("p");
  error.className = "form-error";
  error.setAttribute("role", "alert");

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "secondary-action";
  submit.textContent = latestJob?.status === "failed" ? "Retry Export" : "Export Preview";
  submit.disabled = !currentUser.canExportToJira;

  form.append(keyField, traceabilityField, error, submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const result = aiGenerationService.exportToJira(
      project.projectId,
      {
        jiraProjectKey: String(formData.get("jiraProjectKey") ?? ""),
        exportMode: "CreateEpicsAndStories",
        includeTraceabilityLinks: Boolean(formData.get("includeTraceabilityLinks")),
        allowWhenNotReady: true
      },
      currentUser.actor
    );

    if (!result.ok && result.exportJob?.status !== "partial") {
      error.textContent = result.error;
      onChange?.();
      return;
    }

    onChange?.();
  });

  const preview = document.createElement("div");
  preview.className = "jira-export-preview";

  if (!latestJob) {
    const empty = document.createElement("p");
    empty.className = "empty-state neutral";
    empty.textContent = "Previewed stories will appear here after export generation.";
    preview.append(empty);
  } else if (latestJob.errors.length > 0 && latestJob.preview.length === 0) {
    const failed = document.createElement("p");
    failed.className = "form-error";
    failed.textContent = latestJob.errors[0]?.message ?? latestJob.errorSummary;
    preview.append(failed);
  } else {
    const list = document.createElement("ul");
    list.className = "jira-issue-list";

    for (const issue of latestJob.preview) {
      const item = document.createElement("li");
      const title = document.createElement("strong");
      title.textContent = `${issue.issueType}: ${issue.title}`;
      const metadata = document.createElement("span");
      const traceId = issue.sourceRequirementId ?? issue.sourceObjectId ?? issue.objectId;
      const epicHint = issue.parentEpicObjectId ? ` | Epic ${issue.parentEpicObjectId}` : "";
      metadata.textContent = `Source ${traceId} | Version ${issue.versionId ?? "n/a"}${epicHint}`;
      item.append(title, metadata);
      list.append(item);
    }

    preview.append(list);
  }

  const created = document.createElement("p");
  created.className = "approval-preview";
  created.textContent = latestJob
    ? `${latestJob.createdIssues.length} Jira issue records created by the mock adapter.`
    : "Mock adapter will return local issue keys for successful exports.";

  panel.append(header, gateMessage, form, preview, created);
  return panel;
}

function renderBlockerItem(blocker, onOpenObject) {
  const item = document.createElement("li");
  item.className = "blocker-item";
  const content = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = blocker.objectTitle ?? blocker.objectId ?? "Project blocker";
  const description = document.createElement("p");
  description.textContent = blocker.description;
  const meta = document.createElement("span");
  meta.textContent = `${formatStatus(blocker.severity)} | ${formatStatus(
    blocker.type
  )} | Owner: ${blocker.ownerName}`;
  content.append(title, description, meta);

  const action = document.createElement("button");
  action.type = "button";
  action.className = "compact-action secondary-action";
  action.textContent = blocker.fixLabel;
  action.disabled = !blocker.objectId;
  action.addEventListener("click", () => onOpenObject(blocker.objectId));
  item.append(content, action);
  return item;
}

function renderApprovalCenter(project, currentUser, decisionObjectService, onChange) {
  const panel = document.createElement("section");
  panel.className = "approval-panel";
  panel.setAttribute("aria-label", "Approval center");

  const header = document.createElement("div");
  header.className = "panel-header";
  const heading = document.createElement("h3");
  heading.textContent = "Approval Center";
  const count = document.createElement("p");
  count.className = "draft-status";

  const queue = decisionObjectService.listApprovalQueue(project.projectId, currentUser.actor);
  const approvals = decisionObjectService.listApprovals(project.projectId);
  count.textContent = `${queue.length} pending for your role`;
  header.append(heading, count);
  panel.append(header);

  if (!currentUser.canApprove) {
    const empty = document.createElement("p");
    empty.className = "empty-state neutral";
    empty.textContent = "Approval queue is read-only for this role.";
    panel.append(empty);
    return panel;
  }

  if (queue.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state neutral";
    empty.textContent = "There are no approvals waiting on you.";
    panel.append(empty);
  } else {
    const list = document.createElement("div");
    list.className = "approval-list";

    for (const item of queue) {
      list.append(renderApprovalQueueItem(project, item, currentUser, decisionObjectService, onChange));
    }

    panel.append(list);
  }

  if (approvals.length > 0) {
    const history = document.createElement("ul");
    history.className = "approval-history";

    for (const approval of approvals.slice(-4).reverse()) {
      const row = document.createElement("li");
      row.textContent = `${approval.objectTitle ?? approval.objectId}: ${formatStatus(
        approval.approvalDecision
      )} by ${formatOwner(approval.approverId, decisionObjectService.listAssignableOwners())}`;
      history.append(row);
    }

    panel.append(history);
  }

  return panel;
}

function renderApprovalQueueItem(project, item, currentUser, decisionObjectService, onChange) {
  const card = document.createElement("article");
  card.className = "approval-card";

  const title = document.createElement("h4");
  title.textContent = item.title;
  const meta = document.createElement("p");
  meta.className = "draft-status";
  meta.textContent = `${formatStatus(item.objectType)} | v${item.versionNumber} | ${formatStatus(
    item.status
  )}`;

  const preview = document.createElement("p");
  preview.className = "approval-preview";
  preview.textContent = approvalContentPreview(item);
  const traceability = document.createElement("p");
  traceability.className = "approval-preview";
  traceability.textContent = item.traceabilityStatus;
  const invalidation = renderApprovalInvalidationNotice(item);
  const diff = renderVersionDiff(item.diff);

  const form = document.createElement("form");
  form.className = "approval-form";

  const commentField = document.createElement("label");
  commentField.textContent = "Comment";
  const comment = document.createElement("textarea");
  comment.name = "comment";
  comment.rows = 3;
  commentField.append(comment);

  const error = document.createElement("p");
  error.className = "form-error";
  error.setAttribute("role", "alert");

  const actions = document.createElement("div");
  actions.className = "draft-actions";

  for (const [label, decision] of [
    ["Approve", APPROVAL_DECISIONS.APPROVED],
    ["Request Changes", APPROVAL_DECISIONS.CHANGES_REQUESTED],
    ["Reject", APPROVAL_DECISIONS.REJECTED]
  ]) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.className =
      decision === APPROVAL_DECISIONS.REJECTED ? "danger-action" : "secondary-action";
    button.addEventListener("click", () => {
      const result = decisionObjectService.submitApproval(
        project.projectId,
        item.objectId,
        {
          version: item.versionNumber,
          approvalDecision: decision,
          comment: comment.value
        },
        currentUser.actor
      );

      if (!result.ok) {
        error.textContent = result.error;
        return;
      }

      form.reset();
      onChange();
    });
    actions.append(button);
  }

  form.append(commentField, error, actions);
  card.append(title, meta, preview, traceability, invalidation, diff, form);
  return card;
}

function renderApprovalInvalidationNotice(item) {
  const notice = document.createElement("p");
  notice.className = "approval-preview invalidated-approval";

  if (!item.invalidatedApproval) {
    notice.hidden = true;
    return notice;
  }

  notice.textContent = `Prior ${formatStatus(
    item.invalidatedApproval.approvalDecision
  )} decision was invalidated: ${item.invalidatedApproval.invalidationReason}`;
  return notice;
}

function renderVersionDiff(diff) {
  const section = document.createElement("section");
  section.className = "version-diff";
  section.setAttribute("aria-label", "Version diff");

  if (!diff || diff.changes.length === 0) {
    section.hidden = true;
    return section;
  }

  const heading = document.createElement("h5");
  heading.textContent = `Changes from v${diff.fromVersion} to v${diff.toVersion}`;
  const list = document.createElement("ul");

  for (const change of diff.changes) {
    const item = document.createElement("li");
    const field = document.createElement("strong");
    field.textContent = `${formatStatus(change.field.replace("content.", ""))}: `;
    const before = document.createElement("span");
    before.className = "diff-before";
    before.textContent = stringifyDiffValue(change.before);
    const after = document.createElement("span");
    after.className = "diff-after";
    after.textContent = stringifyDiffValue(change.after);
    item.append(field, before, document.createTextNode(" -> "), after);
    list.append(item);
  }

  section.append(heading, list);
  return section;
}

function approvalContentPreview(item) {
  const content = item.content ?? {};

  for (const key of ["summary", "requirement", "risk", "mitigation"]) {
    if (typeof content[key] === "string" && content[key].trim()) {
      return content[key];
    }
  }

  if (Array.isArray(content.acceptance_criteria)) {
    return content.acceptance_criteria.join(" ");
  }

  return "No structured preview available.";
}

function stringifyDiffValue(value) {
  if (value === null || value === undefined) {
    return "Empty";
  }

  if (Array.isArray(value)) {
    return value.join("; ") || "Empty";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function renderDecisionObjectCreateForm(project, currentUser, decisionObjectService, onChange) {
  const form = document.createElement("form");
  form.className = "draft-edit-form object-create-form";
  form.setAttribute("aria-label", "Create decision object");

  if (!currentUser.canEditProject) {
    return form;
  }

  const heading = document.createElement("h4");
  heading.textContent = "Create Decision Object";

  const typeField = document.createElement("label");
  typeField.textContent = "Type";
  const typeSelect = document.createElement("select");
  typeSelect.name = "type";
  for (const [label, value] of [
    ["Workflow", "workflow"],
    ["Requirement", "requirement"],
    ["Test", "test"],
    ["Risk", "risk"]
  ]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    typeSelect.append(option);
  }
  typeField.append(typeSelect);

  const titleField = createInput("Title", "title", true);
  const contentField = document.createElement("label");
  contentField.textContent = "Content";
  const contentArea = document.createElement("textarea");
  contentArea.name = "content";
  contentArea.rows = 4;
  contentArea.required = true;
  contentField.append(contentArea);

  const error = document.createElement("p");
  error.className = "form-error";
  error.setAttribute("role", "alert");

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.textContent = "Create Object";

  form.append(heading, typeField, titleField, contentField, error, submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const type = String(formData.get("type") ?? "requirement");
    const result = decisionObjectService.createDecisionObject(
      project.projectId,
      {
        type,
        title: String(formData.get("title") ?? ""),
        content: editableTextToDraftContent({ type }, String(formData.get("content") ?? ""))
      },
      currentUser.actor
    );

    if (!result.ok) {
      error.textContent = result.error;
      return;
    }

    form.reset();
    onChange();
  });

  return form;
}

function renderDraftReviewWorkspace(
  project,
  currentUser,
  aiGenerationService,
  drafts,
  onChange,
  initialSelectedObjectId = null
) {
  const workspace = document.createElement("div");
  workspace.className = "draft-review-workspace";
  workspace.setAttribute("aria-label", "Draft review workspace");

  const sectionNav = document.createElement("div");
  sectionNav.className = "draft-section-nav";

  const editor = document.createElement("section");
  editor.className = "draft-editor";
  editor.setAttribute("aria-label", "Draft editor");

  const editableDrafts = drafts.filter(
    (draft) => draft.content?.ai_review_status !== DRAFT_REVIEW_STATUSES.REJECTED
  );
  const firstDraft = editableDrafts[0] ?? drafts[0];
  const initialDraft = drafts.find((draft) => draft.objectId === initialSelectedObjectId);
  let selectedObjectId = initialDraft?.objectId ?? firstDraft.objectId;

  function selectDraft(objectId) {
    selectedObjectId = objectId;
    renderNavigation();
    renderEditor();
  }

  function renderNavigation() {
    sectionNav.innerHTML = "";

    const groups = [
      ["Workflows", "workflow"],
      ["Requirements", "requirement"],
      ["Tests", "test"],
      ["Risks", "risk"]
    ];

    for (const [label, type] of groups) {
      const group = document.createElement("section");
      group.className = "draft-group";
      const groupHeading = document.createElement("h4");
      groupHeading.textContent = label;
      group.append(groupHeading);

      const items = drafts.filter((draft) => draft.type === type);

      if (items.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty-state neutral";
        empty.textContent = "None yet.";
        group.append(empty);
      }

      for (const draft of items) {
        const button = document.createElement("button");
        button.type = "button";
        button.className =
          draft.objectId === selectedObjectId ? "draft-item selected" : "draft-item";
        button.addEventListener("click", () => selectDraft(draft.objectId));

        const title = document.createElement("strong");
        title.textContent = draft.title;
        const meta = document.createElement("span");
        meta.textContent = formatDraftMeta(draft, aiGenerationService.listAssignableOwners());
        button.append(title, meta);
        group.append(button);
      }

      sectionNav.append(group);
    }
  }

  function renderEditor() {
    editor.innerHTML = "";
    const draft = drafts.find((candidate) => candidate.objectId === selectedObjectId);

    if (!draft) {
      const empty = document.createElement("p");
      empty.className = "empty-state neutral";
      empty.textContent = "No draft selected.";
      editor.append(empty);
      return;
    }

    const header = document.createElement("div");
    header.className = "draft-editor-header";
    const heading = document.createElement("h4");
    heading.textContent = draft.title;
    const badge = document.createElement("span");
    badge.className = "draft-badge";
    badge.textContent = formatDraftReviewStatus(draft);
    header.append(heading, badge);

    const form = document.createElement("form");
    form.className = "draft-edit-form";

    const titleField = createInput("Title", "title", true);
    titleField.querySelector("input").value = draft.title;

    const contentField = document.createElement("label");
    contentField.textContent = "Content";
    const contentArea = document.createElement("textarea");
    contentArea.name = "content";
    contentArea.rows = 8;
    contentArea.required = true;
    contentArea.value = draftContentToEditableText(draft);
    contentField.append(contentArea);

    const reasonField = createInput("Change reason", "changeReason");
    const error = document.createElement("p");
    error.className = "form-error";
    error.setAttribute("role", "alert");
    const ownerField = renderOwnerAssignmentField(
      project,
      draft,
      currentUser,
      aiGenerationService,
      onChange,
      error
    );

    const actions = document.createElement("div");
    actions.className = "draft-actions";
    const save = document.createElement("button");
    save.type = "submit";
    save.textContent = "Save Draft";
    save.disabled = !currentUser.canEditProject;
    const accept = document.createElement("button");
    accept.type = "button";
    accept.className = "secondary-action";
    accept.textContent = "Accept";
    accept.disabled = !currentUser.canEditProject;
    const reject = document.createElement("button");
    reject.type = "button";
    reject.className = "danger-action";
    reject.textContent = "Reject";
    reject.disabled = !currentUser.canEditProject;
    actions.append(save, accept, reject);

    form.append(titleField, contentField, reasonField, ownerField, error, actions);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const result = aiGenerationService.updateDraft(
        project.projectId,
        draft.objectId,
        {
          title: String(new FormData(form).get("title") ?? ""),
          content: editableTextToDraftContent(draft, contentArea.value),
          changeReason: String(new FormData(form).get("changeReason") ?? "")
        },
        currentUser.actor
      );

      if (!result.ok) {
        error.textContent = result.error;
        return;
      }

      onChange();
    });

    accept.addEventListener("click", () => {
      const result = aiGenerationService.acceptDraft(
        project.projectId,
        draft.objectId,
        currentUser.actor
      );

      if (!result.ok) {
        error.textContent = result.error;
        return;
      }

      onChange();
    });

    reject.addEventListener("click", () => {
      const result = aiGenerationService.rejectDraft(
        project.projectId,
        draft.objectId,
        currentUser.actor
      );

      if (!result.ok) {
        error.textContent = result.error;
        return;
      }

      onChange();
    });

    const acceptanceCriteriaPanel = renderAcceptanceCriteriaPanel(
      project,
      draft,
      currentUser,
      aiGenerationService,
      onChange,
      error
    );
    const traceabilityPanel = renderTraceabilityPanel(
      project,
      draft,
      drafts,
      currentUser,
      aiGenerationService,
      onChange,
      error
    );
    const overlay = renderDraftOverlay(draft, aiGenerationService.listAssignableOwners());
    editor.append(header, form, acceptanceCriteriaPanel, traceabilityPanel, overlay);
  }

  renderNavigation();
  renderEditor();
  workspace.append(sectionNav, editor);
  return workspace;
}

function renderTraceabilityPanel(
  project,
  draft,
  drafts,
  currentUser,
  aiGenerationService,
  onChange,
  sharedError
) {
  const panel = document.createElement("section");
  panel.className = "traceability-panel";
  panel.setAttribute("aria-label", "Traceability links");

  const heading = document.createElement("h4");
  heading.textContent = "Traceability";
  panel.append(heading);

  if (draft.type !== DECISION_OBJECT_TYPES.REQUIREMENT) {
    const empty = document.createElement("p");
    empty.className = "empty-state neutral";
    empty.textContent = "Traceability links are managed from requirements.";
    panel.append(empty);
    return panel;
  }

  const links = aiGenerationService.listTraceLinks(project.projectId, draft.objectId);
  const hasWorkflowLink = links.some(
    (link) =>
      link.sourceObjectId === draft.objectId &&
      link.relationshipType === TRACE_RELATIONSHIP_TYPES.DERIVED_FROM &&
      link.targetType === DECISION_OBJECT_TYPES.WORKFLOW
  );
  const hasTestLink = links.some(
    (link) =>
      link.sourceObjectId === draft.objectId &&
      link.relationshipType === TRACE_RELATIONSHIP_TYPES.VALIDATED_BY &&
      link.targetType === DECISION_OBJECT_TYPES.TEST
  );

  const requiredList = document.createElement("ul");
  requiredList.className = "trace-required-list";
  for (const [label, isComplete] of [
    ["Workflow link", hasWorkflowLink],
    ["Acceptance criteria/test link", hasTestLink]
  ]) {
    const item = document.createElement("li");
    item.textContent = `${label}: ${isComplete ? "Linked" : "Missing"}`;
    item.className = isComplete ? "trace-complete" : "trace-missing";
    requiredList.append(item);
  }
  panel.append(requiredList);

  const linkList = document.createElement("ul");
  linkList.className = "trace-link-list";
  for (const link of links) {
    const item = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = `${formatRelationship(link.relationshipType)} -> ${
      link.targetTitle ?? link.targetObjectId
    }`;
    item.append(label);

    if (currentUser.canEditProject) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "secondary-action compact-action";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => {
        const result = aiGenerationService.deleteTraceLink(
          project.projectId,
          draft.objectId,
          link.linkId
        );

        if (!result.ok) {
          sharedError.textContent = result.error;
          return;
        }

        onChange();
      });
      item.append(remove);
    }

    linkList.append(item);
  }

  if (links.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state neutral";
    empty.textContent = "No active trace links.";
    panel.append(empty);
  } else {
    panel.append(linkList);
  }

  if (!currentUser.canEditProject) {
    return panel;
  }

  const form = document.createElement("form");
  form.className = "trace-link-form";

  const relationshipField = document.createElement("label");
  relationshipField.textContent = "Relationship";
  const relationshipSelect = document.createElement("select");
  relationshipSelect.name = "relationshipType";
  for (const [label, value] of [
    ["Derived from workflow", TRACE_RELATIONSHIP_TYPES.DERIVED_FROM],
    ["Validated by test", TRACE_RELATIONSHIP_TYPES.VALIDATED_BY],
    ["Depends on", TRACE_RELATIONSHIP_TYPES.DEPENDS_ON],
    ["References", TRACE_RELATIONSHIP_TYPES.REFERENCES]
  ]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    relationshipSelect.append(option);
  }
  relationshipField.append(relationshipSelect);

  const targetField = document.createElement("label");
  targetField.textContent = "Target object";
  const targetSelect = document.createElement("select");
  targetSelect.name = "targetObjectId";
  for (const candidate of drafts.filter((candidate) => candidate.objectId !== draft.objectId)) {
    const option = document.createElement("option");
    option.value = candidate.objectId;
    option.textContent = `${candidate.title} (${formatStatus(candidate.type)})`;
    targetSelect.append(option);
  }
  targetField.append(targetSelect);

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "secondary-action";
  submit.textContent = "Add Link";
  submit.disabled = targetSelect.options.length === 0;

  form.append(relationshipField, targetField, submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const result = aiGenerationService.createTraceLink(
      project.projectId,
      draft.objectId,
      {
        targetObjectId: String(formData.get("targetObjectId") ?? ""),
        relationshipType: String(formData.get("relationshipType") ?? "")
      },
      currentUser.actor
    );

    if (!result.ok) {
      sharedError.textContent = result.error;
      return;
    }

    onChange();
  });

  panel.append(form);
  return panel;
}

function renderAcceptanceCriteriaPanel(
  project,
  draft,
  currentUser,
  aiGenerationService,
  onChange,
  sharedError
) {
  const panel = document.createElement("section");
  panel.className = "acceptance-criteria-panel";
  panel.setAttribute("aria-label", "Acceptance criteria");

  const heading = document.createElement("h4");
  heading.textContent = "Acceptance Criteria";
  panel.append(heading);

  if (draft.type !== DECISION_OBJECT_TYPES.REQUIREMENT) {
    const empty = document.createElement("p");
    empty.className = "empty-state neutral";
    empty.textContent = "Acceptance criteria are authored from requirements.";
    panel.append(empty);
    return panel;
  }

  const criteria = aiGenerationService.listAcceptanceCriteria(project.projectId, draft.objectId);

  if (criteria.length === 0) {
    const missing = document.createElement("p");
    missing.className = "trace-missing acceptance-missing";
    missing.textContent = "Missing acceptance criteria/test link.";
    panel.append(missing);
  } else {
    const list = document.createElement("ul");
    list.className = "acceptance-criteria-list";

    for (const item of criteria) {
      const row = document.createElement("li");
      const label = document.createElement("strong");
      label.textContent = `${item.title} | v${item.currentVersion}`;
      const details = document.createElement("span");
      details.textContent = item.criteria.join(" ");
      row.append(label, details);
      list.append(row);
    }

    panel.append(list);
  }

  if (!currentUser.canEditProject) {
    return panel;
  }

  const form = document.createElement("form");
  form.className = "acceptance-criteria-form";

  const titleField = createInput("Test title", "title");
  const criteriaField = document.createElement("label");
  criteriaField.textContent = "Criteria";
  const criteriaArea = document.createElement("textarea");
  criteriaArea.name = "criteria";
  criteriaArea.rows = 3;
  criteriaArea.required = true;
  criteriaField.append(criteriaArea);

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "secondary-action";
  submit.textContent = "Add Criteria";

  form.append(titleField, criteriaField, submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const result = aiGenerationService.createAcceptanceCriteria(
      project.projectId,
      draft.objectId,
      {
        title: String(formData.get("title") ?? ""),
        criteria: String(formData.get("criteria") ?? "")
      },
      currentUser.actor
    );

    if (!result.ok) {
      sharedError.textContent = result.error;
      return;
    }

    form.reset();
    onChange();
  });

  panel.append(form);
  return panel;
}

function renderOwnerAssignmentField(
  project,
  draft,
  currentUser,
  aiGenerationService,
  onChange,
  error
) {
  const field = document.createElement("label");
  field.textContent = "Owner";
  const select = document.createElement("select");
  select.name = "ownerId";
  select.disabled = !currentUser.canManageProject;

  const missing = document.createElement("option");
  missing.value = "";
  missing.textContent = "Ownership needed";
  select.append(missing);

  for (const owner of aiGenerationService.listAssignableOwners()) {
    const option = document.createElement("option");
    option.value = owner.userId;
    option.textContent = `${owner.displayName} (${formatStatus(owner.role)})`;
    select.append(option);
  }

  select.value = draft.ownerId ?? "";
  select.addEventListener("change", () => {
    if (!select.value) {
      return;
    }

    const result = aiGenerationService.assignOwner(
      project.projectId,
      draft.objectId,
      select.value,
      currentUser.actor
    );

    if (!result.ok) {
      error.textContent = result.error;
      return;
    }

    onChange();
  });

  field.append(select);
  return field;
}

function renderDraftOverlay(draft, owners = []) {
  const overlay = document.createElement("aside");
  overlay.className = "draft-overlay";
  overlay.setAttribute("aria-label", "Draft details");

  const sourceDocumentIds = draft.content?.source_document_ids ?? [];
  const rows = [
    ["Owner", formatOwner(draft.ownerId, owners)],
    ["Status", formatStatus(draft.status)],
    ["Version", `v${draft.currentVersion}`],
    ["Source", sourceDocumentIds.length > 0 ? sourceDocumentIds.join(", ") : "No source reference"],
    ["Required action", getDraftRequiredAction(draft)]
  ];

  for (const [label, value] of rows) {
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value;
    overlay.append(term, description);
  }

  return overlay;
}

function draftContentToEditableText(draft) {
  const content = draft.content ?? {};

  for (const key of ["summary", "requirement", "risk", "mitigation"]) {
    if (typeof content[key] === "string" && content[key].trim()) {
      return content[key];
    }
  }

  if (Array.isArray(content.acceptance_criteria)) {
    return content.acceptance_criteria.join("\n");
  }

  return "";
}

function editableTextToDraftContent(draft, text) {
  const value = text.trim();

  if (draft.type === "workflow") {
    return { summary: value };
  }

  if (draft.type === "requirement") {
    return { requirement: value };
  }

  if (draft.type === "test") {
    return {
      acceptance_criteria: value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    };
  }

  if (draft.type === "risk") {
    return { risk: value };
  }

  return { summary: value };
}

function formatDraftMeta(draft, owners = []) {
  return `${formatDraftReviewStatus(draft)} | v${draft.currentVersion} | ${formatOwner(
    draft.ownerId,
    owners
  )}`;
}

function formatDraftReviewStatus(draft) {
  return formatStatus(draft.content?.ai_review_status ?? DRAFT_REVIEW_STATUSES.SUGGESTED);
}

function getDraftRequiredAction(draft) {
  if (draft.content?.ai_review_status === DRAFT_REVIEW_STATUSES.ACCEPTED) {
    return draft.ownerId ? "Ready for ownership handoff" : "Assign an owner";
  }

  if (draft.content?.ai_review_status === DRAFT_REVIEW_STATUSES.REJECTED) {
    return "Excluded from readiness";
  }

  return "Review, edit, accept, or reject";
}

function getBlockerFixLabel(blocker) {
  if (blocker.type === BLOCKER_TYPES.MISSING_APPROVAL) {
    return "Review approval";
  }

  if (blocker.type === BLOCKER_TYPES.MISSING_TRACEABILITY) {
    return "Fix traceability";
  }

  return "Open object";
}

function formatOwner(ownerId, owners = []) {
  if (!ownerId) {
    return "Ownership needed";
  }

  return (
    owners.find((owner) => owner.userId === ownerId || owner.id === ownerId)?.displayName ??
    ownerId
  );
}

function formatRelationship(relationshipType) {
  return formatStatus(relationshipType);
}

function formatDocumentValidationError(error) {
  if (error === DOCUMENT_VALIDATION_ERRORS.UNSUPPORTED_FILE_TYPE) {
    return "Unsupported file type";
  }

  if (error === DOCUMENT_VALIDATION_ERRORS.FILE_CONTENT_REQUIRED) {
    return "File content is required";
  }

  return "Document upload is invalid";
}

function toDocumentRecord(document) {
  return {
    document_id: document.documentId,
    project_id: document.projectId,
    file_name: document.fileName,
    document_type: document.documentType,
    storage_uri: document.storageUri,
    upload_status: document.uploadStatus,
    uploaded_by: document.uploadedBy,
    uploaded_at: document.uploadedAt,
    extracted_text_uri: document.extractedTextUri,
    checksum: document.checksum
  };
}

function toProjectRecord(project) {
  return {
    project_id: project.projectId,
    name: project.name,
    description: project.description,
    customer: project.customer,
    contract_number: project.contractNumber,
    program_name: project.programName,
    status: project.status,
    readiness_status: project.readinessStatus,
    readiness_score: project.readinessScore,
    created_by: project.createdBy,
    created_at: project.createdAt,
    updated_at: project.updatedAt
  };
}

if (typeof document !== "undefined") {
  renderAppShell(document.getElementById("app"));
} else {
  console.log("Open apps/web/index.html in a browser to view the scaffold.");
}
