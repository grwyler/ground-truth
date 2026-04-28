import { createMvpSeedData } from "../seed/mvp-seed.js";

export function createInMemoryProjectRepository(seedData = createMvpSeedData()) {
  const state = {
    projects: seedData.projects.map(cloneRecord),
    documents: (seedData.documents ?? []).map(cloneRecord),
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
