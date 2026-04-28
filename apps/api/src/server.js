import { createServer } from "node:http";
import {
  createInMemoryProjectRepository,
  createPersistenceConfig
} from "../../../packages/db/src/index.js";
import { getApplicationMetadata } from "../../../packages/domain/src/index.js";
import { createLocalStorageAdapter } from "../../../packages/storage/src/index.js";
import { handleAuthRoute } from "./auth/routes.js";
import { createAiRoute } from "./routes/ai.js";
import { createDocumentsRoute } from "./routes/documents.js";
import { createProjectsRoute, sendJson } from "./routes/projects.js";

export function createApiServer({
  metadata = getApplicationMetadata(),
  projectRepository = createInMemoryProjectRepository(),
  aiDraftAdapter,
  storageAdapter = createLocalStorageAdapter({
    root: createPersistenceConfig().storageRoot
  })
} = {}) {
  const handleAiRoute = createAiRoute({ projectRepository, aiDraftAdapter });
  const handleProjectsRoute = createProjectsRoute({ projectRepository });
  const handleDocumentsRoute = createDocumentsRoute({ projectRepository, storageAdapter });

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

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}`) {
  const port = Number.parseInt(process.env.API_PORT ?? "4000", 10);
  const server = createApiServer();

  server.listen(port, () => {
    console.log(`Ground Truth API scaffold listening on http://localhost:${port}`);
  });
}
