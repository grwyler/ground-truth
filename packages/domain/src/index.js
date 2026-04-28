const APPLICATION_METADATA = Object.freeze({
  name: "Ground Truth",
  stage: "MVP scaffold"
});

export function getApplicationMetadata() {
  return APPLICATION_METADATA;
}

export const workspaceBoundaries = Object.freeze([
  "apps/web",
  "apps/api",
  "packages/domain",
  "packages/db",
  "tests"
]);

export * from "./auth.js";
export * from "./acceptance-criteria.js";
export * from "./ai.js";
export * from "./decision-objects.js";
export * from "./documents.js";
export * from "./models/index.js";
export * from "./ownership.js";
export * from "./projects.js";
export * from "./roles.js";
export * from "./traceability.js";
