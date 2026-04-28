import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createMvpSeedData, validateMvpSeedData } from "../packages/db/src/index.js";

const seedRoot = path.join(".data", "seed");
const seedFile = path.join(seedRoot, "mvp-seed.json");
const seedData = createMvpSeedData();
const validation = validateMvpSeedData(seedData);

if (!validation.valid) {
  throw new Error(`MVP seed data is invalid:\n${validation.errors.join("\n")}`);
}

await rm(seedRoot, { force: true, recursive: true });
await mkdir(seedRoot, { recursive: true });
await writeFile(seedFile, `${JSON.stringify(seedData, null, 2)}\n`);

console.log(`Reset MVP seed data at ${seedFile}.`);
