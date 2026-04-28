import test from "node:test";
import assert from "node:assert/strict";
import {
  createPilotHarness,
  runPilotHappyPath,
  runPilotOverridePath
} from "../fixtures/mvp-pilot/pilot-flow.js";

test("MVP happy path resolves blockers before certification and Jira export", async () => {
  const harness = await createPilotHarness();

  try {
    const result = await runPilotHappyPath(harness.baseUrl);
    const auditEvents = harness.repository.listAuditEvents(result.project.projectId);

    assert.equal(result.readiness.status, "ready");
    assert.equal(result.certification.status, "generated");
    assert.equal(result.exportJob.status, "completed");
    assert.ok(auditEvents.some((event) => event.entity_type === "certification_package"));
    assert.ok(auditEvents.some((event) => event.entity_type === "jira_export"));
  } finally {
    await harness.close();
  }
});

test("MVP override path opens the gate while keeping risk acceptance visible", async () => {
  const harness = await createPilotHarness();

  try {
    const result = await runPilotOverridePath(harness.baseUrl);
    const auditEvents = harness.repository.listAuditEvents(result.project.projectId);

    assert.equal(result.readiness.status, "ready");
    assert.equal(result.readiness.overrides.length, 1);
    assert.equal(result.override.blockerIds.length, result.readiness.resolvedBlockers.length);
    assert.equal(result.certification.artifact.overrides.length, 1);
    assert.equal(result.exportJob.status, "completed");
    assert.ok(auditEvents.some((event) => event.entity_type === "override"));
    assert.ok(auditEvents.some((event) => event.entity_type === "jira_export"));
  } finally {
    await harness.close();
  }
});
