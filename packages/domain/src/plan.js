import { DECISION_OBJECT_TYPES, TRACE_RELATIONSHIP_TYPES } from "./models/index.js";

export const GENERATED_PLAN_SCHEMA_VERSION = "mvp-plan-v1";

export function buildGeneratedPlan(
  project,
  documents = [],
  {
    decisionObjects = [],
    decisionObjectVersions = [],
    traceLinks = []
  } = {}
) {
  if (!project?.project_id) {
    return Object.freeze({ ok: false, error: "PLAN_PROJECT_REQUIRED" });
  }

  const activeDecisionObjects = decisionObjects.filter(
    (decisionObject) => decisionObject.status !== "rejected"
  );
  const decisionObjectById = new Map(
    activeDecisionObjects.map((decisionObject) => [decisionObject.object_id, decisionObject])
  );
  const currentVersionByObjectId = new Map();

  for (const decisionObject of activeDecisionObjects) {
    const version = decisionObjectVersions.find(
      (candidate) =>
        candidate.object_id === decisionObject.object_id &&
        candidate.version_number === decisionObject.current_version
    );

    if (version) {
      currentVersionByObjectId.set(decisionObject.object_id, version);
    }
  }

  const workflows = activeDecisionObjects
    .filter((decisionObject) => decisionObject.type === DECISION_OBJECT_TYPES.WORKFLOW)
    .map((workflow) => {
      const version = currentVersionByObjectId.get(workflow.object_id);
      const content = version?.content ?? {};

      return Object.freeze({
        workflowId: workflow.object_id,
        title: workflow.title,
        summary: normalizeOptionalString(content.summary) ?? workflow.title,
        sourceDocumentIds: Object.freeze(toSourceDocumentIds(content))
      });
    });

  const requirements = activeDecisionObjects
    .filter((decisionObject) => decisionObject.type === DECISION_OBJECT_TYPES.REQUIREMENT)
    .map((requirement) => {
      const version = currentVersionByObjectId.get(requirement.object_id);
      const content = version?.content ?? {};
      const derivedFromWorkflowIds = traceLinks
        .filter(
          (link) =>
            link.source_object_id === requirement.object_id &&
            link.relationship_type === TRACE_RELATIONSHIP_TYPES.DERIVED_FROM
        )
        .map((link) => link.target_object_id)
        .filter((targetId) => decisionObjectById.get(targetId)?.type === DECISION_OBJECT_TYPES.WORKFLOW);

      return Object.freeze({
        requirementId: requirement.object_id,
        title: requirement.title,
        statement:
          normalizeOptionalString(content.requirement) ??
          normalizeOptionalString(content.summary) ??
          requirement.title,
        workflowIds: Object.freeze([...new Set(derivedFromWorkflowIds)]),
        acceptanceCriteria: Object.freeze(toAcceptanceCriteria(content)),
        priority: requirement.priority ?? null,
        sourceDocumentIds: Object.freeze(toSourceDocumentIds(content))
      });
    });

  const risks = activeDecisionObjects
    .filter((decisionObject) => decisionObject.type === DECISION_OBJECT_TYPES.RISK)
    .map((risk) => {
      const version = currentVersionByObjectId.get(risk.object_id);
      const content = version?.content ?? {};

      return Object.freeze({
        riskId: risk.object_id,
        title: risk.title,
        description:
          normalizeOptionalString(content.risk) ??
          normalizeOptionalString(content.summary) ??
          risk.title,
        mitigation: normalizeOptionalString(content.mitigation) ?? null,
        impact: normalizeOptionalString(content.impact) ?? null,
        likelihood: normalizeOptionalString(content.likelihood) ?? null,
        sourceDocumentIds: Object.freeze(toSourceDocumentIds(content))
      });
    });

  const missingInformation = inferMissingInformation({
    documents,
    workflows,
    requirements,
    keywords: extractKeywords(
      documents
        .map((document) => document.extracted_text ?? document.extractedText ?? "")
        .join("\n\n")
    )
  });

  return Object.freeze({
    ok: true,
    plan: Object.freeze({
      schemaVersion: GENERATED_PLAN_SCHEMA_VERSION,
      projectId: project.project_id,
      projectName: project.name ?? project.project_id,
      sourceDocuments: Object.freeze(
        documents.map((document) =>
          Object.freeze({
            documentId: document.document_id ?? document.documentId,
            fileName: document.file_name ?? document.fileName,
            documentType: document.document_type ?? document.documentType ?? null
          })
        )
      ),
      workflows: Object.freeze(workflows),
      requirements: Object.freeze(requirements),
      risks: Object.freeze(risks),
      missingInformation
    })
  });
}

function inferMissingInformation({ documents = [], workflows = [], requirements = [], keywords = [] } = {}) {
  const items = [];

  if (documents.length === 0) {
    items.push(
      missingInfo(
        "documents",
        "Upload the primary SOW (or contract exhibits) to ground the plan.",
        "No source documents are attached yet."
      )
    );
  }

  if (workflows.length === 0) {
    items.push(
      missingInfo(
        "workflows",
        "What are the top 3–5 user journeys this project must support?",
        "No workflows were generated yet."
      )
    );
  }

  const criteriaMissing = requirements.filter((req) => req.acceptanceCriteria.length === 0);
  if (criteriaMissing.length > 0) {
    items.push(
      missingInfo(
        "acceptance_criteria",
        "For each requirement, what observable outcome proves it is done?",
        `${criteriaMissing.length} requirement(s) are missing acceptance criteria.`
      )
    );
  }

  const workflowTraceMissing = requirements.filter((req) => req.workflowIds.length === 0);
  if (workflowTraceMissing.length > 0) {
    items.push(
      missingInfo(
        "traceability",
        "Which workflow does each requirement belong to?",
        `${workflowTraceMissing.length} requirement(s) are not linked to a workflow yet.`
      )
    );
  }

  for (const item of [
    [
      "scope",
      "What is explicitly out of scope (to avoid ticket sprawl)?",
      "Vague SOWs often omit boundaries."
    ],
    [
      "integrations",
      "Which external systems/integrations are required (and who owns them)?",
      "Integrations drive most schedule risk."
    ],
    [
      "data",
      "What data sources exist (format, access method, and sample availability)?",
      "Data ambiguity is a common blocker."
    ],
    [
      "non_functional",
      "What are the non-functional requirements (security, performance, availability, compliance)?",
      "Non-functional needs usually hide in assumptions."
    ]
  ]) {
    items.push(missingInfo(item[0], item[1], item[2]));
  }

  if (keywords.includes("mine") || keywords.includes("minesweeper") || (keywords.includes("grid") && keywords.includes("tiles"))) {
    items.unshift(
      missingInfo(
        "game_rules",
        "Which minesweeper rules should apply (first-click safety, chord behavior, difficulty presets, scoring)?",
        "Game rules are often under-specified and drive user expectations."
      )
    );
  } else if (keywords.length > 0) {
    items.unshift(
      missingInfo(
        "domain_assumptions",
        `Confirm domain assumptions for: ${keywords.slice(0, 6).join(", ")}.`,
        "The plan is derived from keywords; confirming intent prevents wrong workflows."
      )
    );
  }

  return Object.freeze(items);
}

function missingInfo(category, question, reason) {
  return Object.freeze({
    id: `missing-${category}`,
    category,
    question,
    reason
  });
}

function toAcceptanceCriteria(content) {
  if (!content) {
    return [];
  }

  if (Array.isArray(content.acceptance_criteria)) {
    return content.acceptance_criteria.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof content.acceptance_criteria === "string") {
    return content.acceptance_criteria
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  return [];
}

function toSourceDocumentIds(content) {
  if (!content) {
    return [];
  }

  if (Array.isArray(content.source_document_ids)) {
    return content.source_document_ids.map((id) => String(id)).filter(Boolean);
  }

  return [];
}

function normalizeOptionalString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function extractKeywords(text) {
  const normalized = String(text ?? "").toLowerCase();
  const words = normalized
    .replace(/[^a-z0-9\s-]+/g, " ")
    .split(/\s+/g)
    .map((word) => word.trim())
    .filter(Boolean);

  const stopwords = new Set([
    "the",
    "and",
    "or",
    "to",
    "of",
    "in",
    "a",
    "an",
    "for",
    "with",
    "on",
    "by",
    "is",
    "are",
    "be",
    "as",
    "at",
    "from",
    "that",
    "this",
    "these",
    "those",
    "will",
    "shall",
    "must",
    "should",
    "can",
    "may",
    "include",
    "including",
    "provided",
    "provide",
    "user",
    "users",
    "system",
    "application",
    "app",
    "project",
    "work",
    "scope",
    "requirements",
    "requirement"
  ]);

  const counts = new Map();
  for (const word of words) {
    if (word.length < 3) {
      continue;
    }

    if (stopwords.has(word)) {
      continue;
    }

    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 12)
    .map(([word]) => word);
}
