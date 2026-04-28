import { getApplicationMetadata } from "../../../packages/domain/src/index.js";
import { createLocalCurrentUser } from "./lib/session/current-user.js";

export function renderAppShell(
  container,
  metadata = getApplicationMetadata(),
  currentUser = createLocalCurrentUser()
) {
  if (!container) {
    throw new Error("A container element is required to render the app shell.");
  }

  container.innerHTML = "";

  const shell = document.createElement("section");
  shell.className = "app-shell";

  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = metadata.stage;

  const title = document.createElement("h1");
  title.textContent = metadata.name;

  const summary = document.createElement("p");
  summary.className = "summary";
  summary.textContent = `Readiness workspace scaffold for ${currentUser.actor.roleLabel}`;

  shell.append(eyebrow, title, summary);

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

  shell.append(nav);
  container.append(shell);

  return shell;
}

if (typeof document !== "undefined") {
  renderAppShell(document.getElementById("app"));
} else {
  console.log("Open apps/web/index.html in a browser to view the scaffold.");
}
