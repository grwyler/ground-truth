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
            title: `${projectName}: Intake & Discovery`,
            priority: PRIORITIES.HIGH,
            sourceDocumentIds: Object.freeze([primaryDocument.document_id]),
            content: Object.freeze({
              summary:
                "Review the SOW, clarify scope boundaries, identify stakeholders, and confirm operational context needed to plan the work.",
              source_summary: `Generated from ${documentNames}.`,
              steps: Object.freeze([
                "Identify stakeholders and acceptance authority.",
                "Confirm in-scope outcomes and out-of-scope exclusions.",
                "Capture open questions and assumptions.",
                "Summarize the workflows the solution must support."
              ])
            })
          }),
          Object.freeze({
            type: DECISION_OBJECT_TYPES.WORKFLOW,
            title: `${projectName}: Delivery & Acceptance`,
            priority: PRIORITIES.HIGH,
            sourceDocumentIds: Object.freeze([primaryDocument.document_id]),
            content: Object.freeze({
              summary:
                "Build, validate, and hand off deliverables with explicit acceptance criteria, including a Jira-ready delivery plan.",
              source_summary: `Generated from ${documentNames}.`,
              steps: Object.freeze([
                "Derive requirements per workflow.",
                "Define acceptance criteria per requirement.",
                "Call out risks, dependencies, and missing information.",
                "Export epics/stories to Jira for delivery execution."
              ])
            })
          }),
          Object.freeze({
            type: DECISION_OBJECT_TYPES.REQUIREMENT,
            title: "Document upload and parsing",
            priority: PRIORITIES.HIGH,
            sourceDocumentIds: Object.freeze([primaryDocument.document_id]),
            content: Object.freeze({
              requirement:
                "The system must accept a vague SOW upload and extract enough structured context to generate a usable plan.",
              acceptance_criteria: Object.freeze([
                "User can upload PDF, DOCX, or TXT documents.",
                "Uploaded documents are listed with filename and type.",
                "Plan generation can be started after at least one document upload."
              ]),
              derived_from_workflow_title: `${projectName}: Intake & Discovery`
            })
          }),
          Object.freeze({
            type: DECISION_OBJECT_TYPES.REQUIREMENT,
            title: "Workflow generation",
            priority: PRIORITIES.HIGH,
            sourceDocumentIds: Object.freeze([primaryDocument.document_id]),
            content: Object.freeze({
              requirement:
                "The system must generate a set of workflows that represent the key journeys implied by the SOW.",
              acceptance_criteria: Object.freeze([
                "Workflows include a short summary and optional steps.",
                "Each workflow references at least one source document id."
              ]),
              derived_from_workflow_title: `${projectName}: Intake & Discovery`
            })
          }),
          Object.freeze({
            type: DECISION_OBJECT_TYPES.REQUIREMENT,
            title: "Requirements + acceptance criteria per workflow",
            priority: PRIORITIES.HIGH,
            sourceDocumentIds: Object.freeze([primaryDocument.document_id]),
            content: Object.freeze({
              requirement:
                "The system must generate requirements grouped by workflow, each with clear, testable acceptance criteria.",
              acceptance_criteria: Object.freeze([
                "Requirements are grouped under a workflow in the summary view.",
                "Each requirement includes acceptance criteria (one per line).",
                "Users can edit workflow summaries, requirements, and acceptance criteria."
              ]),
              derived_from_workflow_title: `${projectName}: Delivery & Acceptance`
            })
          }),
          Object.freeze({
            type: DECISION_OBJECT_TYPES.REQUIREMENT,
            title: "Risks and missing information",
            priority: PRIORITIES.MEDIUM,
            sourceDocumentIds: Object.freeze([primaryDocument.document_id]),
            content: Object.freeze({
              requirement:
                "The system must surface risks and highlight missing information that must be clarified to execute.",
              acceptance_criteria: Object.freeze([
                "Risks are listed with mitigation suggestions.",
                "Missing information is shown as clear questions to ask stakeholders."
              ]),
              derived_from_workflow_title: `${projectName}: Intake & Discovery`
            })
          }),
          Object.freeze({
            type: DECISION_OBJECT_TYPES.REQUIREMENT,
            title: "Jira-ready tickets export",
            priority: PRIORITIES.HIGH,
            sourceDocumentIds: Object.freeze([primaryDocument.document_id]),
            content: Object.freeze({
              requirement:
                "The system must export Jira-ready tickets where epics map to workflows and stories map to requirements, preserving traceability.",
              acceptance_criteria: Object.freeze([
                "Export includes epics for each workflow.",
                "Export includes stories for each requirement and links them to the epic.",
                "Acceptance criteria is included in the story description.",
                "Each created ticket includes traceability metadata (source object ids + version ids)."
              ]),
              derived_from_workflow_title: `${projectName}: Delivery & Acceptance`
            })
          }),
          Object.freeze({
            type: DECISION_OBJECT_TYPES.TEST,
            title: "Plan generation outputs a usable, editable plan",
            priority: PRIORITIES.MEDIUM,
            sourceDocumentIds: Object.freeze(documents.map((document) => document.document_id)),
            content: Object.freeze({
              acceptance_criteria: Object.freeze([
                "Given an uploaded SOW, when plan generation completes, then workflows, requirements, risks, and missing information are shown.",
                "Given a generated plan, when a user edits items in the plan view, then the underlying draft objects update.",
                "Given a generated plan, when Jira export runs, then epics map to workflows and stories map to requirements."
              ]),
              validates_requirement_title: "Requirements + acceptance criteria per workflow"
            })
          }),
          Object.freeze({
            type: DECISION_OBJECT_TYPES.RISK,
            title: "SOW ambiguity creates scope risk",
            priority: PRIORITIES.MEDIUM,
            sourceDocumentIds: Object.freeze(documents.map((document) => document.document_id)),
            content: Object.freeze({
              risk:
                "The SOW may omit key constraints (integrations, data access, non-functional requirements), leading to rework or ticket churn.",
              mitigation:
                "Highlight missing information as explicit questions; treat answers as plan updates before execution.",
              likelihood: "High",
              impact: "High"
            })
          })
        ])
      });
    }
  });
}
