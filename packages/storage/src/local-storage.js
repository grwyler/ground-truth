import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export function createLocalStorageAdapter({ root = ".data/uploads" } = {}) {
  return Object.freeze({
    async putObject({ projectId, objectId, fileName, bytes }) {
      const safeProjectId = sanitizePathSegment(projectId);
      const safeObjectId = sanitizePathSegment(objectId);
      const safeFileName = sanitizePathSegment(fileName);
      const directory = path.join(root, safeProjectId);
      const objectPath = path.join(directory, `${safeObjectId}-${safeFileName}`);

      await mkdir(directory, { recursive: true });
      await writeFile(objectPath, bytes);

      return {
        storageUri: `local://${objectPath.replaceAll("\\", "/")}`
      };
    }
  });
}

function sanitizePathSegment(value) {
  return String(value ?? "file")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "file";
}
