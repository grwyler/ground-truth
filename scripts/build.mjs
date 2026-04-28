import { copyFile, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getApplicationMetadata } from "../packages/domain/src/index.js";

async function copyDirectory(source, destination) {
  const entries = await readdir(source, { withFileTypes: true });

  await mkdir(destination, { recursive: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destinationPath);
      continue;
    }

    if (entry.isFile()) {
      await copyFile(sourcePath, destinationPath);
    }
  }
}

const distRoot = "dist";
const webDist = path.join(distRoot, "web");

await rm(distRoot, { force: true, recursive: true });
await mkdir(webDist, { recursive: true });

await copyFile("apps/web/index.html", path.join(webDist, "index.html"));
await copyDirectory("apps/web/src", path.join(webDist, "src"));

await writeFile(
  path.join(distRoot, "manifest.json"),
  `${JSON.stringify(
    {
      builtAt: new Date().toISOString(),
      app: getApplicationMetadata(),
      artifacts: ["web/index.html"]
    },
    null,
    2
  )}\n`
);

console.log("Build completed in dist/.");
