import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { startApiHttpServer } from "../../apps/api/src/server.js";
import { startDevServer } from "../../scripts/dev.mjs";

test("dev:api starts an HTTP server on port 4000 and keeps /health available", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  const devApiCommand = packageJson.scripts["dev:api"];
  assert.equal(devApiCommand, "node apps/api/src/server.js");

  const { server, started } = startApiHttpServer({ port: 4000 });

  try {
    await started;
    const health = await waitForHealth("http://127.0.0.1:4000/health");

    assert.equal(health.ok, true);
    assert.equal(health.service, "Ground Truth");
    assert.equal(server.listening, true);

    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(server.listening, true, "dev:api exited instead of staying available.");
  } finally {
    await closeServer(server);
  }
});

test("dev starts the MVP app, API health, and browser module graph on port 4000", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  assert.equal(packageJson.scripts.dev, "node scripts/dev.mjs");

  const { server, started } = startDevServer({ port: 4000 });

  try {
    await started;

    const health = await waitForHealth("http://127.0.0.1:4000/health");
    assert.equal(health.ok, true);
    assert.equal(health.service, "Ground Truth");

    const htmlResponse = await fetch("http://127.0.0.1:4000/");
    const html = await htmlResponse.text();
    assert.equal(htmlResponse.status, 200);
    assert.match(html, /<main id="app"><\/main>/);
    assert.match(html, /src="\.\/src\/main\.js"/);

    const mainModuleResponse = await fetch("http://127.0.0.1:4000/src/main.js");
    const mainModule = await mainModuleResponse.text();
    assert.equal(mainModuleResponse.status, 200);
    assert.match(mainModule, /renderAppShell/);

    const domainModuleResponse = await fetch(
      "http://127.0.0.1:4000/packages/domain/src/index.js"
    );
    const domainModule = await domainModuleResponse.text();
    assert.equal(domainModuleResponse.status, 200);
    assert.match(domainModule, /export \* from "\.\/auth\.js"/);

    assert.equal(server.listening, true);
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(server.listening, true, "dev exited instead of staying available.");
  } finally {
    await closeServer(server);
  }
});

async function waitForHealth(url) {
  const deadline = Date.now() + 5000;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return response.json();
      }

      lastError = new Error(`Health check returned ${response.status}.`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw lastError ?? new Error("Health check did not become available.");
}

function closeServer(server) {
  if (!server.listening) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
