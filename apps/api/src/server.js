import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createInMemoryProjectRepository,
  createPersistenceConfig
} from "../../../packages/db/src/index.js";
import { getApplicationMetadata } from "../../../packages/domain/src/index.js";
import { createLocalStorageAdapter } from "../../../packages/storage/src/index.js";
import { handleAuthRoute } from "./auth/routes.js";
import { createAuditRoute } from "./routes/audit.js";
import { createAiRoute } from "./routes/ai.js";
import { createApprovalsRoute } from "./routes/approvals.js";
import { createCertificationPackageRoute } from "./routes/certification-package.js";
import { createDecisionObjectsRoute } from "./routes/decision-objects.js";
import { createDocumentsRoute } from "./routes/documents.js";
import { createJiraExportRoute } from "./routes/jira-export.js";
import { createOverridesRoute } from "./routes/overrides.js";
import { createProjectsRoute, sendJson } from "./routes/projects.js";
import { createReadinessRoute } from "./routes/readiness.js";

export function createApiServer({
  metadata = getApplicationMetadata(),
  projectRepository = createInMemoryProjectRepository(),
  aiDraftAdapter,
  now,
  idGenerator,
  storageAdapter = createLocalStorageAdapter({
    root: createPersistenceConfig().storageRoot
  })
} = {}) {
  const handleAiRoute = createAiRoute({ projectRepository, aiDraftAdapter, now, idGenerator });
  const handleAuditRoute = createAuditRoute({ projectRepository });
  const handleApprovalsRoute = createApprovalsRoute({ projectRepository, now, idGenerator });
  const handleCertificationPackageRoute = createCertificationPackageRoute({
    projectRepository,
    now,
    idGenerator
  });
  const handleDecisionObjectsRoute = createDecisionObjectsRoute({
    projectRepository,
    now,
    idGenerator
  });
  const handleJiraExportRoute = createJiraExportRoute({
    projectRepository,
    now,
    idGenerator
  });
  const handleOverridesRoute = createOverridesRoute({ projectRepository, now, idGenerator });
  const handleProjectsRoute = createProjectsRoute({ projectRepository, now, idGenerator });
  const handleReadinessRoute = createReadinessRoute({ projectRepository, now, idGenerator });
  const handleDocumentsRoute = createDocumentsRoute({
    projectRepository,
    storageAdapter,
    now,
    idGenerator
  });

  return createServer(async (request, response) => {
    if (handleAuthRoute(request, response)) {
      return;
    }

    if (await handleAiRoute(request, response)) {
      return;
    }

    if (await handleDocumentsRoute(request, response)) {
      return;
    }

    if (await handleAuditRoute(request, response)) {
      return;
    }

    if (await handleApprovalsRoute(request, response)) {
      return;
    }

    if (await handleReadinessRoute(request, response)) {
      return;
    }

    if (await handleOverridesRoute(request, response)) {
      return;
    }

    if (await handleCertificationPackageRoute(request, response)) {
      return;
    }

    if (await handleJiraExportRoute(request, response)) {
      return;
    }

    if (await handleDecisionObjectsRoute(request, response)) {
      return;
    }

    if (await handleProjectsRoute(request, response)) {
      return;
    }

    if (request.method === "GET" && request.url === "/health") {
      sendJson(response, 200, {
        ok: true,
        service: metadata.name,
        stage: metadata.stage
      });
      return;
    }

    sendJson(response, 404, { error: "NOT_FOUND" });
  });
}

export function startApiHttpServer({
  port = Number.parseInt(process.env.API_PORT ?? "4000", 10),
  onListening,
  ...serverOptions
} = {}) {
  const server = createApiServer(serverOptions);
  const started = new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => {
      server.off("error", reject);
      onListening?.(server);
      resolve(server);
    });
  });

  return Object.freeze({ server, started });
}

function isMainModule() {
  return Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
}

if (isMainModule()) {
  const port = Number.parseInt(process.env.API_PORT ?? "4000", 10);
  const { started } = startApiHttpServer({
    port,
    onListening() {
      console.log(`Ground Truth API scaffold listening on http://localhost:${port}`);
    }
  });

  started.catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
