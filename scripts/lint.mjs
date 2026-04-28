import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const roots = ["apps", "packages", "scripts", "tests"];
const allowedExtensions = new Set([".js", ".mjs"]);

async function collectJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectJavaScriptFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && allowedExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

const files = (
  await Promise.all(roots.map((root) => collectJavaScriptFiles(root)))
).flat();

for (const file of files) {
  const source = await readFile(file, "utf8");
  const relativeFile = file.replaceAll("\\", "/");

  if (source.includes("\t")) {
    throw new Error(`${relativeFile} contains tab indentation.`);
  }

  if (source.includes("\r\n")) {
    throw new Error(`${relativeFile} must use LF line endings.`);
  }
}

console.log(`Lint passed for ${files.length} JavaScript files.`);
