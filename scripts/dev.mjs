import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApiServer } from "../apps/api/src/server.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WEB_ROOT = path.join(REPO_ROOT, "apps", "web");
const STATIC_ROUTES = Object.freeze([
  Object.freeze({ prefix: "/src/", root: path.join(WEB_ROOT, "src") }),
  Object.freeze({ prefix: "/packages/", root: path.join(REPO_ROOT, "packages") })
]);

export function createDevServer() {
  const apiServer = createApiServer();

  return createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");

    if (requestUrl.pathname === "/health" || requestUrl.pathname.startsWith("/api/")) {
      apiServer.emit("request", request, response);
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      sendPlain(response, 405, "Method not allowed");
      return;
    }

    const staticFile = resolveStaticFile(requestUrl.pathname);

    if (!staticFile) {
      sendPlain(response, 404, "Not found");
      return;
    }

    await streamFile(response, staticFile, request.method === "HEAD");
  });
}

export function startDevServer({
  port = Number.parseInt(process.env.PORT ?? process.env.API_PORT ?? "4000", 10),
  onListening
} = {}) {
  const server = createDevServer();
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

function resolveStaticFile(urlPathname) {
  if (urlPathname === "/" || urlPathname === "/index.html") {
    return path.join(WEB_ROOT, "index.html");
  }

  for (const route of STATIC_ROUTES) {
    if (!urlPathname.startsWith(route.prefix)) {
      continue;
    }

    const relativePath = decodeURIComponent(urlPathname.slice(route.prefix.length));
    const filePath = path.resolve(route.root, relativePath);

    if (isInsideRoot(filePath, route.root)) {
      return filePath;
    }
  }

  return null;
}

async function streamFile(response, filePath, headersOnly) {
  try {
    const fileStat = await stat(filePath);

    if (!fileStat.isFile()) {
      sendPlain(response, 404, "Not found");
      return;
    }

    response.writeHead(200, {
      "content-type": getContentType(filePath),
      "content-length": fileStat.size
    });

    if (headersOnly) {
      response.end();
      return;
    }

    createReadStream(filePath).pipe(response);
  } catch {
    sendPlain(response, 404, "Not found");
  }
}

function sendPlain(response, statusCode, message) {
  response.writeHead(statusCode, { "content-type": "text/plain; charset=utf-8" });
  response.end(message);
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".html") {
    return "text/html; charset=utf-8";
  }

  if (extension === ".css") {
    return "text/css; charset=utf-8";
  }

  if (extension === ".js" || extension === ".mjs") {
    return "text/javascript; charset=utf-8";
  }

  if (extension === ".json") {
    return "application/json; charset=utf-8";
  }

  return "application/octet-stream";
}

function isInsideRoot(filePath, root) {
  const relativePath = path.relative(root, filePath);

  return Boolean(relativePath) && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const port = Number.parseInt(process.env.PORT ?? process.env.API_PORT ?? "4000", 10);
  const { started } = startDevServer({
    port,
    onListening() {
      console.log(`Ground Truth MVP running at http://localhost:${port}`);
      console.log(`API health available at http://localhost:${port}/health`);
    }
  });

  started.catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
