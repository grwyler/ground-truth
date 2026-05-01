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
      const projectName = project.name ?? "Project";
      const normalizedDocuments = documents.map((document) => ({
        id: document.document_id,
        name: document.file_name ?? "source",
        text: normalizeOptionalString(document.extracted_text ?? document.text_content ?? document.textContent) ?? ""
      }));
      const combinedText = normalizedDocuments.map((document) => document.text).join("\n\n").trim();
      const keywords = extractKeywords(combinedText || normalizedDocuments.map((doc) => doc.name).join(" "));
      const intent = inferIntent(keywords, combinedText);
      const documentNames = normalizedDocuments.map((document) => document.name).join(", ");
      const debug = Object.freeze({
        documentNames,
        keywordCandidates: Object.freeze(keywords),
        inputPreview: combinedText ? combinedText.slice(0, 1200) : "(no document text available)"
      });

      const workflows = buildWorkflowsFromIntent(projectName, intent, keywords, primaryDocument.document_id);
      const requirements = buildRequirementsFromWorkflows(intent, workflows, keywords, primaryDocument.document_id);
      const risks = buildRisksFromIntent(intent, keywords, normalizedDocuments.map((doc) => doc.id));
      const testObject = buildPlanTest(primaryDocument.document_id, normalizedDocuments.map((doc) => doc.id));

      return Object.freeze({
        schemaVersion: AI_DRAFT_SCHEMA_VERSION,
        debug,
        suggestions: Object.freeze([
          ...workflows,
          ...requirements,
          testObject,
          ...risks
        ])
      });
    }
  });
}

function buildWorkflowsFromIntent(projectName, intent, keywords, sourceDocumentId) {
  const titles = [];

  if (intent.domain === "minesweeper") {
    titles.push(
      `${projectName}: Start a new game`,
      `${projectName}: Play the board (reveal/flag)`,
      `${projectName}: Win/loss and scoring`
    );
  } else if (intent.domain === "dashboard") {
    titles.push(`${projectName}: View dashboards`, `${projectName}: Filter/search data`, `${projectName}: Export/report`);
  } else {
    const top = keywords.slice(0, 4);
    titles.push(
      `${projectName}: Primary user workflow (${top[0] ?? "intake"})`,
      `${projectName}: Secondary workflow (${top[1] ?? "operations"})`,
      `${projectName}: Admin/maintenance workflow (${top[2] ?? "admin"})`
    );
  }

  return titles.map((title, index) =>
    Object.freeze({
      type: DECISION_OBJECT_TYPES.WORKFLOW,
      title,
      priority: index === 0 ? PRIORITIES.HIGH : PRIORITIES.MEDIUM,
      sourceDocumentIds: Object.freeze([sourceDocumentId]),
      content: Object.freeze({
        summary: buildWorkflowSummary(title, intent, keywords),
        source_summary: `Derived from document text. Key concepts: ${keywords.slice(0, 8).join(", ")}.`
      })
    })
  );
}

function buildWorkflowSummary(title, intent, keywords) {
  if (intent.domain === "minesweeper") {
    if (title.includes("Start a new game")) {
      return "Initialize a new minesweeper session, select difficulty, and generate a grid with the correct mine distribution.";
    }
    if (title.includes("Play the board")) {
      return "Allow players to interact with the grid by revealing tiles and flagging suspected mines, updating state deterministically.";
    }
    return "Define win/loss conditions, end-of-game behavior, and any scoring or stats expectations.";
  }

  return `Deliver the capability implied by the SOW around ${keywords.slice(0, 3).join(", ") || "the core system flow"}.`;
}

function buildRequirementsFromWorkflows(intent, workflows, keywords, sourceDocumentId) {
  const requirements = [];
  const primaryWorkflowTitle = workflows[0]?.title ?? "Primary workflow";

  if (intent.domain === "minesweeper") {
    requirements.push(
      requirement(
        "Board and mine generation",
        "The system shall generate a grid-based board with mines placed according to difficulty settings.",
        [
          "Given a selected difficulty, when a new game starts, then the grid dimensions match the difficulty setting.",
          "Given a new game, when mines are placed, then the number of mines matches the difficulty setting.",
          "Given a new game, when a tile is revealed, then adjacent mine counts are computed correctly."
        ],
        primaryWorkflowTitle,
        sourceDocumentId
      ),
      requirement(
        "Tile interaction (reveal and flag)",
        "The system shall allow the user to reveal tiles and flag/unflag suspected mines while preventing invalid moves.",
        [
          "Given an unrevealed tile, when the user reveals it, then the tile becomes revealed and cannot be revealed again.",
          "Given an unrevealed tile, when the user flags it, then the tile shows a flag state and cannot be revealed unless unflagged.",
          "Given a mine tile is revealed, then the game ends in a loss state."
        ],
        workflows[1]?.title ?? primaryWorkflowTitle,
        sourceDocumentId
      ),
      requirement(
        "Win/loss conditions",
        "The system shall declare a win when all non-mine tiles are revealed and declare a loss when a mine is revealed.",
        [
          "Given all non-mine tiles are revealed, then the game ends with a win message/state.",
          "Given a mine tile is revealed, then the game ends and further moves are blocked.",
          "Given a completed game, then the user can start a new game without refreshing the page."
        ],
        workflows[2]?.title ?? primaryWorkflowTitle,
        sourceDocumentId
      )
    );
  } else {
    const baseConcepts = keywords.slice(0, 6);
    for (const [index, workflow] of workflows.entries()) {
      const concept = baseConcepts[index] ?? baseConcepts[0] ?? "capability";
      requirements.push(
        requirement(
          `Deliver ${concept} capability`,
          `The system shall implement the "${concept}" capability described or implied in the source document.`,
          [
            `Given relevant input for ${concept}, when the user completes the workflow, then the expected output is produced.`,
            `Given incomplete information for ${concept}, when generating the plan, then the system asks clarifying questions.`
          ],
          workflow.title,
          sourceDocumentId
        )
      );
    }
  }

  // Always include Jira export as a requirement, but ground it in discovered concepts.
  requirements.push(
    requirement(
      "Jira-ready ticket export",
      `The system shall export epics and stories to Jira using workflows (${workflows.length}) and requirements derived from: ${keywords.slice(0, 8).join(", ")}.`,
      [
        "Given a generated plan, when exporting, then epics are created per workflow.",
        "Given a generated plan, when exporting, then stories are created per requirement and linked back to the epic."
      ],
      workflows.at(-1)?.title ?? primaryWorkflowTitle,
      sourceDocumentId
    )
  );

  return requirements;
}

function buildRisksFromIntent(intent, keywords, sourceDocumentIds) {
  const risks = [];

  if (intent.domain === "minesweeper") {
    risks.push(
      Object.freeze({
        type: DECISION_OBJECT_TYPES.RISK,
        title: "Ambiguity in game rules and UX expectations",
        priority: PRIORITIES.MEDIUM,
        sourceDocumentIds: Object.freeze([...sourceDocumentIds]),
        content: Object.freeze({
          risk:
            "The SOW may not specify exact minesweeper rules (first-click safety, chord behavior, difficulty presets) or UI expectations, leading to rework.",
          mitigation:
            "Confirm rule variants and expected UI/UX (grid size, interactions, accessibility) before implementing.",
          likelihood: "High",
          impact: "Medium"
        })
      })
    );
  } else {
    risks.push(
      Object.freeze({
        type: DECISION_OBJECT_TYPES.RISK,
        title: "SOW ambiguity and missing constraints",
        priority: PRIORITIES.MEDIUM,
        sourceDocumentIds: Object.freeze([...sourceDocumentIds]),
        content: Object.freeze({
          risk:
            `The source text emphasizes ${keywords.slice(0, 5).join(", ") || "high-level outcomes"} but may omit constraints (roles, integrations, data quality, non-functional requirements).`,
          mitigation:
            "Use the missing information questions to confirm constraints early, and update the generated plan before execution.",
          likelihood: "High",
          impact: "High"
        })
      })
    );
  }

  return risks;
}

function buildPlanTest(primaryDocumentId, allDocumentIds) {
  return Object.freeze({
    type: DECISION_OBJECT_TYPES.TEST,
    title: "Generated plan reflects source document text",
    priority: PRIORITIES.MEDIUM,
    sourceDocumentIds: Object.freeze(allDocumentIds.length ? allDocumentIds : [primaryDocumentId]),
    content: Object.freeze({
      acceptance_criteria: Object.freeze([
        "Given uploaded or pasted source text, when plan generation completes, then workflows and requirements reference keywords found in the text.",
        "Given different SOW inputs, when plan generation runs, then the output changes meaningfully."
      ]),
      validates_requirement_title: "Jira-ready ticket export"
    })
  });
}

function requirement(title, statement, acceptanceCriteria, derivedFromWorkflowTitle, sourceDocumentId) {
  return Object.freeze({
    type: DECISION_OBJECT_TYPES.REQUIREMENT,
    title,
    priority: PRIORITIES.HIGH,
    sourceDocumentIds: Object.freeze([sourceDocumentId]),
    content: Object.freeze({
      requirement: statement,
      acceptance_criteria: Object.freeze(acceptanceCriteria),
      derived_from_workflow_title: derivedFromWorkflowTitle
    })
  });
}

function inferIntent(keywords, text) {
  const haystack = `${keywords.join(" ")} ${String(text ?? "")}`.toLowerCase();

  if (
    haystack.includes("minesweeper") ||
    (haystack.includes("mine") && haystack.includes("grid")) ||
    (haystack.includes("tiles") && haystack.includes("mines"))
  ) {
    return Object.freeze({ domain: "minesweeper" });
  }

  if (haystack.includes("dashboard") || haystack.includes("report") || haystack.includes("kpi")) {
    return Object.freeze({ domain: "dashboard" });
  }

  return Object.freeze({ domain: "generic" });
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

    const next = (counts.get(word) ?? 0) + 1;
    counts.set(word, next);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 14)
    .map(([word]) => word);
}

function normalizeOptionalString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}
