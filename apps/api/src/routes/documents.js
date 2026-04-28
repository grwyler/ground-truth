import {
  DOCUMENT_VALIDATION_ERRORS,
  PERMISSIONS,
  authorize,
  buildDocumentRecord,
  buildDocumentUploadedAuditEvent,
  calculateDocumentChecksum,
  getDocumentMimeType,
  toDocumentSummary,
  validateDocumentUpload
} from "../../../../packages/domain/src/index.js";
import { resolveLocalSession } from "../auth/session.js";
import { sendJson } from "./projects.js";

export function createDocumentsRoute({
  projectRepository,
  storageAdapter,
  now,
  idGenerator
} = {}) {
  if (!projectRepository) {
    throw new Error("A project repository is required.");
  }

  if (!storageAdapter) {
    throw new Error("A storage adapter is required.");
  }

  return async function handleDocumentsRoute(request, response) {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    const pathParts = requestUrl.pathname.split("/").filter(Boolean);

    if (
      pathParts.length !== 5 ||
      pathParts[0] !== "api" ||
      pathParts[1] !== "v1" ||
      pathParts[2] !== "projects" ||
      pathParts[4] !== "documents"
    ) {
      return false;
    }

    const projectId = pathParts[3];
    const session = resolveLocalSession(request);

    if (!session.isAuthenticated) {
      sendJson(response, 401, { error: "UNAUTHENTICATED" });
      return true;
    }

    const project = projectRepository.findProjectById(projectId);

    if (!project) {
      sendJson(response, 404, { error: "PROJECT_NOT_FOUND" });
      return true;
    }

    if (request.method === "GET") {
      const authorization = authorize(session.actor, PERMISSIONS.READ_PROJECT);

      if (!authorization.allowed) {
        sendJson(response, 403, { error: "FORBIDDEN" });
        return true;
      }

      sendJson(response, 200, {
        documents: projectRepository.listDocuments(projectId).map(toDocumentSummary),
        canGenerateDraft: projectRepository.listDocuments(projectId).length > 0
      });
      return true;
    }

    if (request.method === "POST") {
      const authorization = authorize(session.actor, PERMISSIONS.MANAGE_PROJECT);

      if (!authorization.allowed) {
        sendJson(response, 403, { error: "FORBIDDEN" });
        return true;
      }

      const parsedUpload = await readUploadRequest(request);

      if (!parsedUpload.ok) {
        sendJson(response, 400, {
          error: parsedUpload.error,
          message: parsedUpload.message
        });
        return true;
      }

      if (parsedUpload.files.length === 0) {
        sendJson(response, 400, {
          error: "VALIDATION_ERROR",
          details: [DOCUMENT_VALIDATION_ERRORS.FILE_NAME_REQUIRED]
        });
        return true;
      }

      for (const file of parsedUpload.files) {
        const validation = validateDocumentUpload({
          projectId,
          fileName: file.fileName,
          byteLength: file.bytes.byteLength
        });

        if (!validation.valid) {
          sendJson(response, 400, {
            error: "VALIDATION_ERROR",
            details: validation.errors
          });
          return true;
        }
      }

      const uploadedDocuments = [];

      for (const file of parsedUpload.files) {
        const documentId = idGenerator?.() ?? undefined;
        const checksum = calculateDocumentChecksum(file.bytes);
        const storageResult = await storageAdapter.putObject({
          projectId,
          objectId: documentId ?? checksum.replace("sha256:", "sha256-").slice(0, 24),
          fileName: file.fileName,
          bytes: file.bytes,
          contentType: file.contentType ?? getDocumentMimeType(file.fileName)
        });
        const result = buildDocumentRecord(
          {
            projectId,
            fileName: file.fileName,
            documentType: parsedUpload.fields.documentType,
            storageUri: storageResult.storageUri,
            byteLength: file.bytes.byteLength,
            bytes: file.bytes,
            checksum
          },
          session.actor,
          {
            now,
            idGenerator: documentId ? () => documentId : undefined
          }
        );

        if (!result.ok) {
          sendJson(response, 400, {
            error: "VALIDATION_ERROR",
            details: result.validation.errors
          });
          return true;
        }

        const auditEvent = buildDocumentUploadedAuditEvent(result.document, session.actor, {
          idGenerator
        });
        const persisted = projectRepository.createDocument(result.document, auditEvent);
        uploadedDocuments.push(toDocumentSummary(persisted));
      }

      sendJson(response, 201, {
        documents: uploadedDocuments,
        inventory: projectRepository.listDocuments(projectId).map(toDocumentSummary),
        canGenerateDraft: projectRepository.listDocuments(projectId).length > 0
      });
      return true;
    }

    sendJson(response, 405, { error: "METHOD_NOT_ALLOWED" });
    return true;
  };
}

async function readUploadRequest(request) {
  const contentType = request.headers["content-type"] ?? "";
  const body = await readRequestBuffer(request);

  if (contentType.includes("multipart/form-data")) {
    return parseMultipartFormData(body, contentType);
  }

  if (contentType.includes("application/json")) {
    return parseJsonUpload(body);
  }

  return {
    ok: false,
    error: "UNSUPPORTED_MEDIA_TYPE",
    message: "Use multipart/form-data with one or more files."
  };
}

async function readRequestBuffer(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

function parseJsonUpload(body) {
  try {
    const parsed = JSON.parse(body.toString("utf8") || "{}");
    const files = (parsed.files ?? []).map((file) => ({
      fileName: file.fileName,
      contentType: file.contentType,
      bytes: Buffer.from(file.content ?? "", "utf8")
    }));

    return {
      ok: true,
      fields: {
        documentType: parsed.documentType
      },
      files
    };
  } catch {
    return {
      ok: false,
      error: "INVALID_JSON",
      message: "Upload body could not be parsed."
    };
  }
}

function parseMultipartFormData(body, contentType) {
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[1] ??
    contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[2];

  if (!boundary) {
    return {
      ok: false,
      error: "INVALID_MULTIPART",
      message: "Multipart boundary is required."
    };
  }

  const fields = {};
  const files = [];
  const boundaryText = `--${boundary}`;
  const parts = body.toString("binary").split(boundaryText).slice(1, -1);

  for (const rawPart of parts) {
    const part = rawPart.replace(/^\r\n/, "").replace(/\r\n$/, "");
    const headerEnd = part.indexOf("\r\n\r\n");

    if (headerEnd === -1) {
      continue;
    }

    const rawHeaders = part.slice(0, headerEnd);
    const rawContent = part.slice(headerEnd + 4);
    const disposition = rawHeaders
      .split("\r\n")
      .find((header) => header.toLowerCase().startsWith("content-disposition:"));
    const contentTypeHeader = rawHeaders
      .split("\r\n")
      .find((header) => header.toLowerCase().startsWith("content-type:"));
    const name = disposition?.match(/name="([^"]+)"/)?.[1];
    const fileName = disposition?.match(/filename="([^"]*)"/)?.[1];

    if (!name) {
      continue;
    }

    if (fileName) {
      files.push({
        fileName,
        contentType: contentTypeHeader?.split(":").slice(1).join(":").trim(),
        bytes: Buffer.from(rawContent, "binary")
      });
      continue;
    }

    fields[name] = rawContent.trim();
  }

  return {
    ok: true,
    fields,
    files
  };
}
