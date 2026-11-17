import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const skip = new Set(["node_modules", ".next", "dist", "coverage"]);
const pattern = /ANTHROPIC_\w*API_KEY/;

export function findKey(dir) {
  const hits = [];
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) hits.push(...findKey(path));
    else if (pattern.test(readFileSync(path, "latin1"))) hits.push(path);
  }
  return hits;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(import.meta.url), "../..");
  const hits = ["apps", "packages"].flatMap((d) => {
    try {
      return findKey(join(root, d));
    } catch {
      return [];
    }
  });
  if (hits.length) {
    console.error("ANTHROPIC_API_KEY must not appear in apps/ or packages/:\n" + hits.join("\n"));
    process.exit(1);
  }
  console.log("no anthropic key names found");
}
