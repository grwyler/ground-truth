import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function collectTestFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectTestFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".test.js")) {
      files.push(fullPath);
    }
  }

  return files;
}

const testFiles = await collectTestFiles("tests");

for (const testFile of testFiles) {
  await import(pathToFileURL(testFile));
}
