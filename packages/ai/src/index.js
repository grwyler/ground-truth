import {
  AI_DRAFT_SCHEMA_VERSION,
  DECISION_OBJECT_TYPES,
  PRIORITIES
} from "../../domain/src/index.js";

export function createDeterministicDraftAdapter({ shouldFail = false } = {}) {
  return Object.freeze({
    async generateDraft({ project, documents }) {
      if (shouldFail) {
        throw new Error("Deterministic AI adapter failure.");
      }

      const primaryDocument = documents[0];
      const documentNames = documents.map((document) => document.file_name).join(", ");
      const projectName = project.name;

      return Object.freeze({
        schemaVersion: AI_DRAFT_SCHEMA_VERSION,
        suggestions: Object.freeze([
          Object.freeze({
            type: DECISION_OBJECT_TYPES.WORKFLOW,
            title: `${projectName} source intake workflow`,
            priority: PRIORITIES.HIGH,
            sourceDocumentIds: Object.freeze([primaryDocument.document_id]),
            content: Object.freeze({
              summary:
                "Review uploaded source material, confirm operational assumptions, and prepare requirements for stakeholder approval.",
              source_summary: `Generated from ${documentNames}.`
            })
          }),
          Object.freeze({
            type: DECISION_OBJECT_TYPES.REQUIREMENT,
            title: "Confirm source-backed build requirement",
            priority: PRIORITIES.HIGH,
            sourceDocumentIds: Object.freeze(documents.map((document) => document.document_id)),
            content: Object.freeze({
              requirement:
                "The delivery team must convert source document obligations into traceable implementation requirements before build start.",
              acceptance_criteria: Object.freeze([
                "Each generated requirement references at least one uploaded source document.",
                "Human reviewers can edit or reject every AI-generated draft before approval."
              ])
            })
          }),
          Object.freeze({
            type: DECISION_OBJECT_TYPES.TEST,
            title: "Generated requirement review acceptance criteria",
            priority: PRIORITIES.MEDIUM,
            sourceDocumentIds: Object.freeze(documents.map((document) => document.document_id)),
            content: Object.freeze({
              acceptance_criteria: Object.freeze([
                "Given uploaded source material, when draft generation completes, then draft objects remain in Draft status."
              ])
            })
          }),
          Object.freeze({
            type: DECISION_OBJECT_TYPES.RISK,
            title: "AI draft requires human validation",
            priority: PRIORITIES.MEDIUM,
            sourceDocumentIds: Object.freeze(documents.map((document) => document.document_id)),
            content: Object.freeze({
              risk:
                "AI-generated content may omit customer-specific nuance until reviewed by accountable owners.",
              mitigation: "Require human review before approval, readiness computation, or Jira export."
            })
          })
        ])
      });
    }
  });
}
