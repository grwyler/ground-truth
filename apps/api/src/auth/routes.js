import {
  PERMISSIONS,
  actorHasPermission
} from "../../../../packages/domain/src/index.js";
import { resolveLocalSession } from "./session.js";

export function handleAuthRoute(request, response) {
  const requestUrl = new URL(request.url ?? "/", "http://localhost");

  if (request.method !== "GET" || requestUrl.pathname !== "/api/v1/auth/session") {
    return false;
  }

  const session = resolveLocalSession(request);

  if (!session.isAuthenticated) {
    response.writeHead(401, {
      "content-type": "application/json; charset=utf-8"
    });
    response.end(JSON.stringify({ error: "UNAUTHENTICATED" }));
    return true;
  }

  response.writeHead(200, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(
    JSON.stringify({
      actor: session.actor,
      permissions: Object.fromEntries(
        Object.values(PERMISSIONS).map((permission) => [
          permission,
          actorHasPermission(session.actor, permission)
        ])
      )
    })
  );
  return true;
}
