import {
  SEEDED_MVP_USERS,
  findSeededActorById,
  normalizeActor
} from "../../../../packages/domain/src/index.js";

const DEFAULT_LOCAL_USER_ID = SEEDED_MVP_USERS[0].id;

export function resolveLocalSession(request, { defaultUserId = DEFAULT_LOCAL_USER_ID } = {}) {
  const requestedUserId = readRequestedUserId(request) ?? defaultUserId;
  const actor = normalizeActor(findSeededActorById(requestedUserId));

  return Object.freeze({
    actor,
    isAuthenticated: Boolean(actor),
    source: "local-dev-auth"
  });
}

function readRequestedUserId(request) {
  const headerUserId = request.headers["x-user-id"];

  if (typeof headerUserId === "string" && headerUserId.trim()) {
    return headerUserId.trim();
  }

  const requestUrl = new URL(request.url ?? "/", "http://localhost");
  return requestUrl.searchParams.get("userId");
}
