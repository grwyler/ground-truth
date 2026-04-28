import { getApplicationMetadata } from "../../../packages/domain/src/index.js";

export function renderAppShell(container, metadata = getApplicationMetadata()) {
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
  summary.textContent = "Readiness workspace scaffold";

  shell.append(eyebrow, title, summary);
  container.append(shell);

  return shell;
}

if (typeof document !== "undefined") {
  renderAppShell(document.getElementById("app"));
} else {
  console.log("Open apps/web/index.html in a browser to view the scaffold.");
}
