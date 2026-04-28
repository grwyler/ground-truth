import {
  AUDIT_EVENT_TYPES,
  DOCUMENT_TYPES,
  DOCUMENT_UPLOAD_STATUSES
} from "./models/index.js";

export const SUPPORTED_DOCUMENT_EXTENSIONS = Object.freeze([".pdf", ".docx", ".txt"]);

export const DOCUMENT_VALIDATION_ERRORS = Object.freeze({
  FILE_NAME_REQUIRED: "DOCUMENT_FILE_NAME_REQUIRED",
  FILE_CONTENT_REQUIRED: "DOCUMENT_FILE_CONTENT_REQUIRED",
  UNSUPPORTED_FILE_TYPE: "DOCUMENT_UNSUPPORTED_FILE_TYPE",
  PROJECT_REQUIRED: "DOCUMENT_PROJECT_REQUIRED"
});

const MIME_TYPE_BY_EXTENSION = Object.freeze({
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain"
});

export function validateDocumentUpload(input = {}) {
  const errors = [];
  const fileName = normalizeOptionalString(input.fileName ?? input.file_name);
  const projectId = normalizeOptionalString(input.projectId ?? input.project_id);
  const byteLength = Number(input.byteLength ?? input.size ?? 0);

  if (!projectId) {
    errors.push(DOCUMENT_VALIDATION_ERRORS.PROJECT_REQUIRED);
  }

  if (!fileName) {
    errors.push(DOCUMENT_VALIDATION_ERRORS.FILE_NAME_REQUIRED);
  } else if (!isSupportedDocumentFileName(fileName)) {
    errors.push(DOCUMENT_VALIDATION_ERRORS.UNSUPPORTED_FILE_TYPE);
  }

  if (!Number.isFinite(byteLength) || byteLength <= 0) {
    errors.push(DOCUMENT_VALIDATION_ERRORS.FILE_CONTENT_REQUIRED);
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors)
  });
}

export function buildDocumentRecord(
  input,
  actor,
  { now = new Date(), idGenerator } = {}
) {
  const validation = validateDocumentUpload(input);

  if (!validation.valid) {
    return Object.freeze({
      ok: false,
      validation
    });
  }

  const timestamp = now.toISOString();
  const fileName = normalizeOptionalString(input.fileName ?? input.file_name);
  const checksum =
    input.checksum ??
    calculateDocumentChecksum(input.bytes ?? input.buffer ?? Buffer.from(""));
  const documentId = idGenerator?.() ?? `doc-${cryptoSafeRandomId()}`;

  return Object.freeze({
    ok: true,
    document: Object.freeze({
      document_id: documentId,
      project_id: normalizeOptionalString(input.projectId ?? input.project_id),
      file_name: fileName,
      document_type: normalizeDocumentType(input.documentType ?? input.document_type, fileName),
      storage_uri: input.storageUri ?? input.storage_uri,
      upload_status: DOCUMENT_UPLOAD_STATUSES.UPLOADED,
      uploaded_by: actor.id,
      uploaded_at: timestamp,
      extracted_text_uri: null,
      checksum
    })
  });
}

export function buildDocumentUploadedAuditEvent(document, actor, { idGenerator } = {}) {
  return Object.freeze({
    audit_event_id: idGenerator?.() ?? `audit-${document.document_id}-upload`,
    project_id: document.project_id,
    actor_id: actor.id,
    event_type: AUDIT_EVENT_TYPES.CREATE,
    entity_type: "document",
    entity_id: document.document_id,
    timestamp: document.uploaded_at,
    details: Object.freeze({
      file_name: document.file_name,
      document_type: document.document_type,
      checksum: document.checksum
    }),
    immutable_hash: null
  });
}

export function toDocumentSummary(document) {
  return Object.freeze({
    documentId: document.document_id,
    projectId: document.project_id,
    fileName: document.file_name,
    documentType: document.document_type,
    storageUri: document.storage_uri,
    uploadStatus: document.upload_status,
    uploadedBy: document.uploaded_by,
    uploadedAt: document.uploaded_at,
    extractedTextUri: document.extracted_text_uri,
    checksum: document.checksum
  });
}

export function calculateDocumentChecksum(bytes) {
  const data = Array.from(bytes ?? [], (byte) => byte & 0xff);
  const hash = sha256(data);

  return `sha256:${hash.map((word) => word.toString(16).padStart(8, "0")).join("")}`;
}

export function getDocumentExtension(fileName) {
  const normalized = normalizeOptionalString(fileName);
  const match = normalized?.toLowerCase().match(/\.[^.]+$/);

  return match?.[0] ?? "";
}

export function getDocumentMimeType(fileName) {
  return MIME_TYPE_BY_EXTENSION[getDocumentExtension(fileName)] ?? "application/octet-stream";
}

export function isSupportedDocumentFileName(fileName) {
  return SUPPORTED_DOCUMENT_EXTENSIONS.includes(getDocumentExtension(fileName));
}

function normalizeDocumentType(documentType, fileName) {
  if (Object.values(DOCUMENT_TYPES).includes(documentType)) {
    return documentType;
  }

  const normalizedName = String(fileName ?? "").toLowerCase();

  if (normalizedName.includes("sow") || normalizedName.includes("statement-of-work")) {
    return DOCUMENT_TYPES.SOW;
  }

  if (normalizedName.includes("proposal")) {
    return DOCUMENT_TYPES.PROPOSAL;
  }

  if (normalizedName.includes("legacy")) {
    return DOCUMENT_TYPES.LEGACY_DOCUMENT;
  }

  if (normalizedName.includes("note")) {
    return DOCUMENT_TYPES.NOTES;
  }

  return DOCUMENT_TYPES.OTHER;
}

function normalizeOptionalString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function cryptoSafeRandomId() {
  return Math.random().toString(36).slice(2, 10);
}

function sha256(bytes) {
  const hash = [
    0x6a09e667,
    0xbb67ae85,
    0x3c6ef372,
    0xa54ff53a,
    0x510e527f,
    0x9b05688c,
    0x1f83d9ab,
    0x5be0cd19
  ];
  const constants = [
    0x428a2f98,
    0x71374491,
    0xb5c0fbcf,
    0xe9b5dba5,
    0x3956c25b,
    0x59f111f1,
    0x923f82a4,
    0xab1c5ed5,
    0xd807aa98,
    0x12835b01,
    0x243185be,
    0x550c7dc3,
    0x72be5d74,
    0x80deb1fe,
    0x9bdc06a7,
    0xc19bf174,
    0xe49b69c1,
    0xefbe4786,
    0x0fc19dc6,
    0x240ca1cc,
    0x2de92c6f,
    0x4a7484aa,
    0x5cb0a9dc,
    0x76f988da,
    0x983e5152,
    0xa831c66d,
    0xb00327c8,
    0xbf597fc7,
    0xc6e00bf3,
    0xd5a79147,
    0x06ca6351,
    0x14292967,
    0x27b70a85,
    0x2e1b2138,
    0x4d2c6dfc,
    0x53380d13,
    0x650a7354,
    0x766a0abb,
    0x81c2c92e,
    0x92722c85,
    0xa2bfe8a1,
    0xa81a664b,
    0xc24b8b70,
    0xc76c51a3,
    0xd192e819,
    0xd6990624,
    0xf40e3585,
    0x106aa070,
    0x19a4c116,
    0x1e376c08,
    0x2748774c,
    0x34b0bcb5,
    0x391c0cb3,
    0x4ed8aa4a,
    0x5b9cca4f,
    0x682e6ff3,
    0x748f82ee,
    0x78a5636f,
    0x84c87814,
    0x8cc70208,
    0x90befffa,
    0xa4506ceb,
    0xbef9a3f7,
    0xc67178f2
  ];
  const bitLength = bytes.length * 8;
  const padded = [...bytes, 0x80];

  while ((padded.length % 64) !== 56) {
    padded.push(0);
  }

  const highBits = Math.floor(bitLength / 0x100000000);
  const lowBits = bitLength >>> 0;

  padded.push(
    (highBits >>> 24) & 0xff,
    (highBits >>> 16) & 0xff,
    (highBits >>> 8) & 0xff,
    highBits & 0xff,
    (lowBits >>> 24) & 0xff,
    (lowBits >>> 16) & 0xff,
    (lowBits >>> 8) & 0xff,
    lowBits & 0xff
  );

  for (let offset = 0; offset < padded.length; offset += 64) {
    const words = new Array(64).fill(0);

    for (let index = 0; index < 16; index += 1) {
      const wordOffset = offset + index * 4;
      words[index] =
        (padded[wordOffset] << 24) |
        (padded[wordOffset + 1] << 16) |
        (padded[wordOffset + 2] << 8) |
        padded[wordOffset + 3];
    }

    for (let index = 16; index < 64; index += 1) {
      const s0 =
        rotateRight(words[index - 15], 7) ^
        rotateRight(words[index - 15], 18) ^
        (words[index - 15] >>> 3);
      const s1 =
        rotateRight(words[index - 2], 17) ^
        rotateRight(words[index - 2], 19) ^
        (words[index - 2] >>> 10);

      words[index] = add32(words[index - 16], s0, words[index - 7], s1);
    }

    let [a, b, c, d, e, f, g, h] = hash;

    for (let index = 0; index < 64; index += 1) {
      const s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = add32(h, s1, choice, constants[index], words[index]);
      const s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = add32(s0, majority);

      h = g;
      g = f;
      f = e;
      e = add32(d, temp1);
      d = c;
      c = b;
      b = a;
      a = add32(temp1, temp2);
    }

    hash[0] = add32(hash[0], a);
    hash[1] = add32(hash[1], b);
    hash[2] = add32(hash[2], c);
    hash[3] = add32(hash[3], d);
    hash[4] = add32(hash[4], e);
    hash[5] = add32(hash[5], f);
    hash[6] = add32(hash[6], g);
    hash[7] = add32(hash[7], h);
  }

  return hash;
}

function rotateRight(value, bits) {
  return (value >>> bits) | (value << (32 - bits));
}

function add32(...values) {
  return values.reduce((sum, value) => (sum + value) >>> 0, 0);
}
