import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createMvpSeedData, validateMvpSeedData } from "../packages/db/src/index.js";
import {
  createPilotHarness,
  runPilotHappyPath,
  runPilotOverridePath
} from "../tests/fixtures/mvp-pilot/pilot-flow.js";

async function resetSeedData() {
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

  return seedFile;
}

const seedFile = await resetSeedData();
console.log(`Reset MVP seed data at ${seedFile}.`);

const happyHarness = await createPilotHarness();

try {
  const result = await runPilotHappyPath(happyHarness.baseUrl);
  console.log(
    `Happy path reached ${result.readiness.status} and exported ${result.exportJob.createdIssues.length} Jira issue(s).`
  );
} finally {
  await happyHarness.close();
}

const overrideHarness = await createPilotHarness();

try {
  const result = await runPilotOverridePath(overrideHarness.baseUrl);
  console.log(
    `Override path reached ${result.readiness.status} with ${result.readiness.overrides.length} visible override(s).`
  );
} finally {
  await overrideHarness.close();
}
