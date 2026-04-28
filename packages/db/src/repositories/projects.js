import { createMvpSeedData } from "../seed/mvp-seed.js";

export function createInMemoryProjectRepository(seedData = createMvpSeedData()) {
  const defaultSeedData = createMvpSeedData();
  const state = {
    projects: seedData.projects.map(cloneRecord),
    documents: (seedData.documents ?? []).map(cloneRecord),
    aiGenerationJobs: (seedData.aiGenerationJobs ?? []).map(cloneRecord),
    decisionObjects: (seedData.decisionObjects ?? []).map(cloneRecord),
    decisionObjectVersions: (seedData.decisionObjectVersions ?? []).map(cloneRecord),
    traceLinks: (seedData.traceLinks ?? []).map(cloneRecord),
    approvals: (seedData.approvals ?? []).map(cloneRecord),
    users: (seedData.users ?? defaultSeedData.users).map(cloneRecord),
    roleAssignments: (seedData.roleAssignments ?? defaultSeedData.roleAssignments).map(cloneRecord),
    auditEvents: (seedData.auditEvents ?? []).map(cloneRecord)
  };

  return Object.freeze({
    listProjects() {
      return state.projects.map(cloneRecord);
    },

    findProjectById(projectId) {
      const project = state.projects.find((candidate) => candidate.project_id === projectId);
      return project ? cloneRecord(project) : null;
    },

    createProject(project, auditEvent) {
      state.projects.push(cloneRecord(project));
      state.auditEvents.push(cloneRecord(auditEvent));

      return cloneRecord(project);
    },

    listDocuments(projectId) {
      return state.documents
        .filter((document) => document.project_id === projectId)
        .map(cloneRecord);
    },

    createDocument(document, auditEvent) {
      state.documents.push(cloneRecord(document));
      state.auditEvents.push(cloneRecord(auditEvent));

      return cloneRecord(document);
    },

    listAiGenerationJobs(projectId) {
      return state.aiGenerationJobs
        .filter((job) => job.project_id === projectId)
        .map(cloneRecord);
    },

    findAiGenerationJob(projectId, generationJobId) {
      const job = state.aiGenerationJobs.find(
        (candidate) =>
          candidate.project_id === projectId &&
          candidate.generation_job_id === generationJobId
      );

      return job ? cloneRecord(job) : null;
    },

    createAiGenerationJob(job) {
      state.aiGenerationJobs.push(cloneRecord(job));

      return cloneRecord(job);
    },

    updateAiGenerationJob(job, auditEvent) {
      const index = state.aiGenerationJobs.findIndex(
        (candidate) => candidate.generation_job_id === job.generation_job_id
      );

      if (index === -1) {
        throw new Error(`Unknown AI generation job: ${job.generation_job_id}`);
      }

      state.aiGenerationJobs[index] = cloneRecord(job);

      if (auditEvent) {
        state.auditEvents.push(cloneRecord(auditEvent));
      }

      return cloneRecord(job);
    },

    listDecisionObjects(projectId) {
      return state.decisionObjects
        .filter((decisionObject) => decisionObject.project_id === projectId)
        .map(cloneRecord);
    },

    findDecisionObject(projectId, objectId) {
      const decisionObject = state.decisionObjects.find(
        (candidate) =>
          candidate.project_id === projectId && candidate.object_id === objectId
      );

      return decisionObject ? cloneRecord(decisionObject) : null;
    },

    findDecisionObjectVersion(objectId, versionNumber) {
      const version = state.decisionObjectVersions.find(
        (candidate) =>
          candidate.object_id === objectId &&
          candidate.version_number === versionNumber
      );

      return version ? cloneRecord(version) : null;
    },

    listDecisionObjectVersions(objectId) {
      return state.decisionObjectVersions
        .filter((version) => version.object_id === objectId)
        .sort((left, right) => left.version_number - right.version_number)
        .map(cloneRecord);
    },

    listDecisionObjectApprovals(objectId) {
      return state.approvals
        .filter((approval) => approval.object_id === objectId)
        .map(cloneRecord);
    },

    listProjectApprovals(projectId) {
      const projectObjectIds = new Set(
        state.decisionObjects
          .filter((decisionObject) => decisionObject.project_id === projectId)
          .map((decisionObject) => decisionObject.object_id)
      );

      return state.approvals
        .filter((approval) => projectObjectIds.has(approval.object_id))
        .map(cloneRecord);
    },

    createApproval(approval, decisionObject, auditEvent) {
      const decisionObjectIndex = state.decisionObjects.findIndex(
        (candidate) => candidate.object_id === decisionObject.object_id
      );

      if (decisionObjectIndex === -1) {
        throw new Error(`Unknown decision object: ${decisionObject.object_id}`);
      }

      state.approvals.push(cloneRecord(approval));
      state.decisionObjects[decisionObjectIndex] = cloneRecord(decisionObject);

      if (auditEvent) {
        state.auditEvents.push(cloneRecord(auditEvent));
      }

      return {
        approval: cloneRecord(approval),
        decisionObject: cloneRecord(decisionObject)
      };
    },

    listTraceLinks(projectId, objectId) {
      return state.traceLinks
        .filter(
          (traceLink) =>
            traceLink.project_id === projectId &&
            (objectId === undefined ||
              traceLink.source_object_id === objectId ||
              traceLink.target_object_id === objectId)
        )
        .map(cloneRecord);
    },

    findTraceLink(projectId, linkId) {
      const traceLink = state.traceLinks.find(
        (candidate) => candidate.project_id === projectId && candidate.link_id === linkId
      );

      return traceLink ? cloneRecord(traceLink) : null;
    },

    createTraceLink(traceLink, auditEvent) {
      state.traceLinks.push(cloneRecord(traceLink));

      if (auditEvent) {
        state.auditEvents.push(cloneRecord(auditEvent));
      }

      return cloneRecord(traceLink);
    },

    deleteTraceLink(projectId, linkId, auditEvent) {
      const traceLinkIndex = state.traceLinks.findIndex(
        (candidate) => candidate.project_id === projectId && candidate.link_id === linkId
      );

      if (traceLinkIndex === -1) {
        return null;
      }

      const [deleted] = state.traceLinks.splice(traceLinkIndex, 1);

      if (auditEvent) {
        state.auditEvents.push(cloneRecord(auditEvent));
      }

      return cloneRecord(deleted);
    },

    listProjectAssignableOwners(projectId) {
      const projectAssignments = state.roleAssignments.filter(
        (assignment) => assignment.project_id === projectId && assignment.object_id === null
      );
      const assignments =
        projectAssignments.length > 0
          ? projectAssignments
          : state.roleAssignments.filter((assignment) => assignment.object_id === null);

      return assignments
        .map((assignment) => {
          const user = state.users.find((candidate) => candidate.user_id === assignment.user_id);

          if (!user) {
            return null;
          }

          return {
            user: cloneRecord(user),
            roleAssignment: cloneRecord(assignment)
          };
        })
        .filter(Boolean);
    },

    createDecisionObject(decisionObject, version, auditEvent) {
      state.decisionObjects.push(cloneRecord(decisionObject));
      state.decisionObjectVersions.push(cloneRecord(version));

      if (auditEvent) {
        state.auditEvents.push(cloneRecord(auditEvent));
      }

      return {
        decisionObject: cloneRecord(decisionObject),
        version: cloneRecord(version)
      };
    },

    createAcceptanceCriteria(decisionObject, version, traceLink, auditEvents = []) {
      state.decisionObjects.push(cloneRecord(decisionObject));
      state.decisionObjectVersions.push(cloneRecord(version));
      state.traceLinks.push(cloneRecord(traceLink));
      state.auditEvents.push(...auditEvents.map(cloneRecord));

      return {
        decisionObject: cloneRecord(decisionObject),
        version: cloneRecord(version),
        traceLink: cloneRecord(traceLink)
      };
    },

    updateDecisionObject(decisionObject, version, auditEvent, invalidatedApprovals = [], auditEvents = []) {
      const decisionObjectIndex = state.decisionObjects.findIndex(
        (candidate) => candidate.object_id === decisionObject.object_id
      );

      if (decisionObjectIndex === -1) {
        throw new Error(`Unknown decision object: ${decisionObject.object_id}`);
      }

      state.decisionObjects[decisionObjectIndex] = cloneRecord(decisionObject);

      const versionExists = state.decisionObjectVersions.some(
        (candidate) => candidate.version_id === version.version_id
      );

      if (!versionExists) {
        state.decisionObjectVersions.push(cloneRecord(version));
      }

      if (auditEvent) {
        state.auditEvents.push(cloneRecord(auditEvent));
      }

      for (const invalidatedApproval of invalidatedApprovals) {
        const approvalIndex = state.approvals.findIndex(
          (candidate) => candidate.approval_id === invalidatedApproval.approval_id
        );

        if (approvalIndex !== -1) {
          state.approvals[approvalIndex] = cloneRecord(invalidatedApproval);
        }
      }

      state.auditEvents.push(...auditEvents.map(cloneRecord));

      return {
        decisionObject: cloneRecord(decisionObject),
        version: cloneRecord(version),
        invalidatedApprovals: invalidatedApprovals.map(cloneRecord)
      };
    },

    updateDecisionObjectDraft(decisionObject, version, auditEvent) {
      const decisionObjectIndex = state.decisionObjects.findIndex(
        (candidate) => candidate.object_id === decisionObject.object_id
      );

      if (decisionObjectIndex === -1) {
        throw new Error(`Unknown decision object: ${decisionObject.object_id}`);
      }

      const versionIndex = state.decisionObjectVersions.findIndex(
        (candidate) => candidate.version_id === version.version_id
      );

      if (versionIndex === -1) {
        throw new Error(`Unknown decision object version: ${version.version_id}`);
      }

      state.decisionObjects[decisionObjectIndex] = cloneRecord(decisionObject);
      state.decisionObjectVersions[versionIndex] = cloneRecord(version);

      if (auditEvent) {
        state.auditEvents.push(cloneRecord(auditEvent));
      }

      return {
        decisionObject: cloneRecord(decisionObject),
        version: cloneRecord(version)
      };
    },

    assignDecisionObjectOwner(decisionObject, auditEvent) {
      const decisionObjectIndex = state.decisionObjects.findIndex(
        (candidate) => candidate.object_id === decisionObject.object_id
      );

      if (decisionObjectIndex === -1) {
        throw new Error(`Unknown decision object: ${decisionObject.object_id}`);
      }

      state.decisionObjects[decisionObjectIndex] = cloneRecord(decisionObject);

      if (auditEvent) {
        state.auditEvents.push(cloneRecord(auditEvent));
      }

      return cloneRecord(decisionObject);
    },

    createDecisionDrafts(decisionObjects, decisionObjectVersions) {
      state.decisionObjects.push(...decisionObjects.map(cloneRecord));
      state.decisionObjectVersions.push(...decisionObjectVersions.map(cloneRecord));

      return {
        decisionObjects: decisionObjects.map(cloneRecord),
        decisionObjectVersions: decisionObjectVersions.map(cloneRecord)
      };
    },

    listAuditEvents(projectId) {
      return state.auditEvents
        .filter((event) => event.project_id === projectId)
        .map(cloneRecord);
    }
  });
}

function cloneRecord(record) {
  return structuredClone(record);
}
