import { createServer } from "node:http";
import { getApplicationMetadata } from "../../../packages/domain/src/index.js";
import { handleAuthRoute } from "./auth/routes.js";

export function createApiServer({ metadata = getApplicationMetadata() } = {}) {
  return createServer((request, response) => {
    if (handleAuthRoute(request, response)) {
      return;
    }

    if (request.method === "GET" && request.url === "/health") {
      const body = JSON.stringify({
        ok: true,
        service: metadata.name,
        stage: metadata.stage
      });

      response.writeHead(200, {
        "content-type": "application/json; charset=utf-8"
      });
      response.end(body);
      return;
    }

    response.writeHead(404, {
      "content-type": "application/json; charset=utf-8"
    });
    response.end(JSON.stringify({ error: "NOT_FOUND" }));
  });
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}`) {
  const port = Number.parseInt(process.env.API_PORT ?? "4000", 10);
  const server = createApiServer();

  server.listen(port, () => {
    console.log(`Ground Truth API scaffold listening on http://localhost:${port}`);
  });
}
