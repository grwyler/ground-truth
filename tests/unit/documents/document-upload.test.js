import test from "node:test";
import assert from "node:assert/strict";
import {
  DOCUMENT_VALIDATION_ERRORS,
  SEEDED_MVP_USERS,
  buildDocumentRecord,
  calculateDocumentChecksum,
  validateDocumentUpload
} from "../../../packages/domain/src/index.js";
import { createInMemoryProjectRepository } from "../../../packages/db/src/index.js";
import { createLocalDocumentService } from "../../../apps/web/src/main.js";

const pm = SEEDED_MVP_USERS[0];

test("document validation accepts PDF, DOCX, and TXT uploads", () => {
  for (const fileName of ["source.pdf", "proposal.docx", "notes.txt"]) {
    const validation = validateDocumentUpload({
      projectId: "project-1",
      fileName,
      byteLength: 12
    });

    assert.equal(validation.valid, true);
  }
});

test("document validation rejects unsupported and empty files", () => {
  const validation = validateDocumentUpload({
    projectId: "project-1",
    fileName: "spreadsheet.xlsx",
    byteLength: 0
  });

  assert.equal(validation.valid, false);
  assert.deepEqual(validation.errors, [
    DOCUMENT_VALIDATION_ERRORS.UNSUPPORTED_FILE_TYPE,
    DOCUMENT_VALIDATION_ERRORS.FILE_CONTENT_REQUIRED
  ]);
});

test("document records include deterministic checksum, uploader, and upload status", () => {
  const bytes = Buffer.from("hello readiness");
  const result = buildDocumentRecord(
    {
      projectId: "project-1",
      fileName: "sow.txt",
      storageUri: "local://test/sow.txt",
      byteLength: bytes.byteLength,
      bytes
    },
    pm,
    {
      now: new Date("2026-04-28T15:00:00.000Z"),
      idGenerator: () => "doc-new"
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.document.document_id, "doc-new");
  assert.equal(result.document.project_id, "project-1");
  assert.equal(result.document.uploaded_by, pm.id);
  assert.equal(result.document.upload_status, "uploaded");
  assert.equal(result.document.checksum, calculateDocumentChecksum(bytes));
});

test("document repository persists documents without deleting existing inventory", () => {
  const repository = createInMemoryProjectRepository({
    projects: [],
    documents: [
      {
        document_id: "doc-existing",
        project_id: "project-1",
        file_name: "existing.txt",
        document_type: "notes",
        storage_uri: "local://existing.txt",
        upload_status: "uploaded",
        uploaded_by: pm.id,
        uploaded_at: "2026-04-28T12:00:00.000Z",
        extracted_text_uri: null,
        checksum: "sha256:existing"
      }
    ],
    auditEvents: []
  });
  const documentRecord = {
    document_id: "doc-new",
    project_id: "project-1",
    file_name: "new.txt",
    document_type: "other",
    storage_uri: "local://new.txt",
    upload_status: "uploaded",
    uploaded_by: pm.id,
    uploaded_at: "2026-04-28T15:00:00.000Z",
    extracted_text_uri: null,
    checksum: "sha256:new"
  };

  repository.createDocument(documentRecord, {
    audit_event_id: "audit-doc-new",
    project_id: "project-1",
    actor_id: pm.id,
    event_type: "create",
    entity_type: "document",
    entity_id: "doc-new",
    timestamp: "2026-04-28T15:00:00.000Z",
    details: {},
    immutable_hash: null
  });

  assert.equal(repository.listDocuments("project-1").length, 2);
  assert.equal(repository.listAuditEvents("project-1").length, 1);
});

test("local document service rejects unsupported files and enables generation after upload", async () => {
  const service = createLocalDocumentService([]);
  const rejected = await service.uploadDocuments(
    "project-1",
    [{ name: "bad.xlsx", size: 20 }],
    pm
  );

  assert.equal(rejected.uploaded.length, 0);
  assert.equal(rejected.errors.length, 1);
  assert.equal(service.listDocuments("project-1").length, 0);

  const accepted = await service.uploadDocuments(
    "project-1",
    [new File(["pilot sow"], "pilot.txt", { type: "text/plain" })],
    pm
  );

  assert.equal(accepted.uploaded.length, 1);
  assert.equal(service.listDocuments("project-1").length, 1);
});
