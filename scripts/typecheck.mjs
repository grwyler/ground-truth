import assert from "node:assert/strict";
import { createApiServer } from "../apps/api/src/server.js";
import { createPersistenceConfig } from "../packages/db/src/index.js";
import {
  getApplicationMetadata,
  workspaceBoundaries
} from "../packages/domain/src/index.js";

const metadata = getApplicationMetadata();
assert.equal(typeof metadata.name, "string");
assert.equal(typeof metadata.stage, "string");

assert.ok(Array.isArray(workspaceBoundaries));
assert.ok(workspaceBoundaries.every((boundary) => typeof boundary === "string"));

const persistenceConfig = createPersistenceConfig({});
assert.equal(typeof persistenceConfig.databaseUrl, "string");
assert.equal(typeof persistenceConfig.storageProvider, "string");
assert.equal(typeof persistenceConfig.storageRoot, "string");

const server = createApiServer();
assert.equal(typeof server.listen, "function");
server.close();

console.log("Typecheck passed for scaffold module contracts.");
