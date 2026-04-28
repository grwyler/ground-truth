import {
  DOCUMENT_UPLOAD_STATUSES,
  DOCUMENT_VALIDATION_ERRORS,
  buildDocumentRecord,
  isSupportedDocumentFileName,
  getApplicationMetadata,
  toDocumentSummary,
  toProjectSummary
} from "../../../packages/domain/src/index.js";
import { createMvpSeedData } from "../../../packages/db/src/index.js";
import { createLocalCurrentUser } from "./lib/session/current-user.js";

export function renderAppShell(
  container,
  metadata = getApplicationMetadata(),
  currentUser = createLocalCurrentUser(),
  projectService = createLocalProjectService(),
  documentService = createLocalDocumentService()
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
  title.textContent = "Projects";

  const summary = document.createElement("p");
  summary.className = "summary";
  summary.textContent = `${metadata.name} ${metadata.stage} workspace for ${currentUser.actor.roleLabel}`;
  header.append(title, summary);

  const nav = document.createElement("nav");
  nav.setAttribute("aria-label", "Available actions");
  nav.className = "role-actions";

  const actions = [
    ["Projects", currentUser.canReadProject],
    ["Manage Project", currentUser.canManageProject],
    ["Approve", currentUser.canApprove],
    ["Override", currentUser.canSubmitOverride],
    ["Jira Export", currentUser.canExportToJira]
  ];

  for (const [label, isVisible] of actions) {
    if (!isVisible) {
      continue;
    }

    const action = document.createElement("span");
    action.textContent = label;
    nav.append(action);
  }

  header.append(nav);
  shell.append(header);

  const content = document.createElement("div");
  content.className = "project-layout";
  const listRegion = document.createElement("section");
  listRegion.className = "project-list";
  listRegion.setAttribute("aria-label", "Project list");
  const workspace = document.createElement("section");
  workspace.className = "project-workspace";
  workspace.setAttribute("aria-label", "Project workspace");

  content.append(listRegion, workspace);
  shell.append(content);
  container.append(shell);

  renderProjectIntake(listRegion, projectService, currentUser, (project) => {
    renderProjectWorkspace(workspace, project, currentUser, documentService);
  });
  renderProjectWorkspace(
    workspace,
    projectService.listProjects()[0] ?? null,
    currentUser,
    documentService
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

function renderProjectWorkspace(container, project, currentUser, documentService) {
  container.innerHTML = "";

  if (!project) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No projects yet.";
    container.append(empty);
    return;
  }

  const heading = document.createElement("h2");
  heading.textContent = project.name;
  const meta = document.createElement("dl");
  meta.className = "project-meta";

  const rows = [
    ["Status", formatStatus(project.status)],
    ["Readiness", formatStatus(project.readinessStatus)],
    ["Score", `${project.readinessScore}%`],
    ["Customer", project.customer ?? "Unassigned"],
    ["Program", project.programName ?? "Unassigned"],
    ["Contract", project.contractNumber ?? "Unassigned"]
  ];

  for (const [label, value] of rows) {
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value;
    meta.append(term, description);
  }

  const documentPanel = renderDocumentInventory(project, currentUser, documentService, () => {
    renderProjectWorkspace(container, project, currentUser, documentService);
  });

  container.append(heading, meta, documentPanel);
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

function formatDocumentValidationError(error) {
  if (error === DOCUMENT_VALIDATION_ERRORS.UNSUPPORTED_FILE_TYPE) {
    return "Unsupported file type";
  }

  if (error === DOCUMENT_VALIDATION_ERRORS.FILE_CONTENT_REQUIRED) {
    return "File content is required";
  }

  return "Document upload is invalid";
}

if (typeof document !== "undefined") {
  renderAppShell(document.getElementById("app"));
} else {
  console.log("Open apps/web/index.html in a browser to view the scaffold.");
}
