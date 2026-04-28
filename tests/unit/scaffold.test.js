import test from "node:test";
import assert from "node:assert/strict";
import { createApiServer } from "../../apps/api/src/server.js";
import {
  getApplicationMetadata,
  workspaceBoundaries
} from "../../packages/domain/src/index.js";
import { createPersistenceConfig } from "../../packages/db/src/index.js";

test("application metadata is available to app boundaries", () => {
  assert.equal(getApplicationMetadata().name, "Ground Truth");
  assert.ok(workspaceBoundaries.includes("apps/web"));
  assert.ok(workspaceBoundaries.includes("apps/api"));
  assert.ok(workspaceBoundaries.includes("packages/domain"));
  assert.ok(workspaceBoundaries.includes("packages/db"));
  assert.ok(workspaceBoundaries.includes("tests"));
});

test("persistence config reads documented environment values", () => {
  const config = createPersistenceConfig({
    DATABASE_URL: "postgres://local/example",
    STORAGE_PROVIDER: "local",
    STORAGE_LOCAL_ROOT: ".data/uploads"
  });

  assert.deepEqual(config, {
    databaseUrl: "postgres://local/example",
    storageProvider: "local",
    storageRoot: ".data/uploads"
  });
});

test("api server can be created for future route handlers", () => {
  const server = createApiServer();

  assert.equal(typeof server.listen, "function");
  server.close();
});
