import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getApplicationMetadata } from "../packages/domain/src/index.js";

const distRoot = "dist";
const webDist = path.join(distRoot, "web");

await rm(distRoot, { force: true, recursive: true });
await mkdir(webDist, { recursive: true });
await mkdir(path.join(webDist, "src"), { recursive: true });

await copyFile("apps/web/index.html", path.join(webDist, "index.html"));
await copyFile("apps/web/src/main.js", path.join(webDist, "src", "main.js"));
await copyFile("apps/web/src/styles.css", path.join(webDist, "src", "styles.css"));

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
