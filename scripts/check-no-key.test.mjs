import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { findKey } from "./check-no-key.mjs";

test("flags a file containing the key name and ignores node_modules", () => {
  const dir = mkdtempSync(join(tmpdir(), "nokey-"));
  mkdirSync(join(dir, "node_modules"));
  writeFileSync(join(dir, "node_modules", "a.js"), "ANTHROPIC_API_KEY");
  writeFileSync(join(dir, "ok.ts"), "const a = 1;");
  expect(findKey(dir)).toEqual([]);
  writeFileSync(join(dir, "bad.ts"), "process.env.ANTHROPIC_API_KEY");
  expect(findKey(dir)).toEqual([join(dir, "bad.ts")]);
});
