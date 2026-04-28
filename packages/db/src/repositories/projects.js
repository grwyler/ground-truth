import { createMvpSeedData } from "../seed/mvp-seed.js";

export function createInMemoryProjectRepository(seedData = createMvpSeedData()) {
  const state = {
    projects: seedData.projects.map(cloneRecord),
    documents: (seedData.documents ?? []).map(cloneRecord),
    aiGenerationJobs: (seedData.aiGenerationJobs ?? []).map(cloneRecord),
    decisionObjects: (seedData.decisionObjects ?? []).map(cloneRecord),
    decisionObjectVersions: (seedData.decisionObjectVersions ?? []).map(cloneRecord),
    auditEvents: seedData.auditEvents.map(cloneRecord)
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
