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
export * from "./roles.js";
