import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse, stringify, validate, validateRun, type Problem } from "../src";

const root = join(__dirname, "..", "fixtures");
const demo = join(__dirname, "..", "..", "..", "examples", "workflows", "demo-day", "workflow.json");
const read = (p: string) => readFileSync(p, "utf8");
const files = (d: string) => readdirSync(join(root, d)).filter((f) => f.endsWith(".json")).sort();
const check = (name: string, text: string): Problem[] => (name.startsWith("run-") ? validateRun(JSON.parse(text)) : validate(JSON.parse(text)));

const expected: Record<string, [level: "error" | "warning", path: string, message: RegExp]> = {
  "wrong-format": ["error", "format", /format must be "relay\/1"/],
  "missing-format": ["error", "format", /needs a format/],
  "missing-name": ["error", "name", /needs a name/],
  "empty-name": ["error", "name", /cannot be empty/],
  "name-too-long": ["error", "name", /too long.*80/],
  "missing-purpose": ["error", "purpose", /needs a purpose/],
  "purpose-too-long": ["error", "purpose", /too long.*300/],
  "description-too-long": ["error", "description", /too long.*2000/],
  "too-many-tags": ["error", "tags", /at most 10 tags/],
  "tag-too-long": ["error", "tags[0]", /too long.*32/],
  "input-bad-sensitivity": ["error", "inputs[0].sensitivity", /Input 1.*not allowed/],
  "input-missing-what": ["error", "inputs[0].what", /Input 1 needs a description/],
  "duplicate-input-id": ["error", "inputs[1].id", /Two inputs share the id in-1/],
  "no-steps": ["error", "steps", /at least one step/],
  "missing-steps": ["error", "steps", /needs a steps/],
  "too-many-steps": ["error", "steps", /at most 30 steps/],
  "bad-step-id": ["error", "steps[0].id", /Step 1.*s- and digits/],
  "duplicate-step-id": ["error", "steps[1].id", /Two steps share the id s-1\./],
  "duplicate-order": ["error", "steps[1].order", /Two steps share the order number 1/],
  "order-gap": ["error", "steps[1].order", /with no gaps/],
  "order-starts-at-zero": ["error", "steps[0].order", /at least 1/],
  "order-not-listed-in-order": ["error", "steps[0].order", /in the order listed/],
  "missing-action": ["error", "steps[0].action", /Step 1 needs an action/],
  "empty-action": ["error", "steps[0].action", /cannot be empty/],
  "action-too-long": ["error", "steps[0].action", /too long.*4000/],
  "missing-role": ["error", "steps[0].role", /Step 1 needs a role/],
  "bad-role": ["error", "steps[0].role", /lowercase/],
  "role-too-long": ["error", "steps[0].role", /too long.*32/],
  "missing-needs": ["error", "steps[0].needs", /needs a needs/],
  "bad-needs": ["error", "steps[0].needs", /none, shell, browser or screen/],
  "missing-expected-result": ["error", "steps[1].expected_result", /Step 2 needs a description of what done looks like\./],
  "expected-result-too-long": ["error", "steps[0].expected_result", /too long.*1000/],
  "missing-reversible": ["error", "steps[0].reversible", /needs a reversible/],
  "bad-reversible": ["error", "steps[0].reversible", /yes, no or unsure/],
  "bad-approval": ["error", "steps[0].approval", /Only each/],
  "unknown-input-used": ["error", "steps[0].inputs_used", /Step 1 uses an input called in-9 that does not exist\./],
  "never-automate-not-list": ["error", "never_automate", /must be a array|must be an? array/],
  "unknown-top-field": ["error", "owner_role", /"owner_role" that relay\/1 does not know/],
  "unknown-step-field": ["error", "steps[0].status", /Step 1 has a field called "status"/],
  "unknown-input-field": ["error", "inputs[0].owner", /Input 1 has a field called "owner"/],
  "secret-api-key": ["error", "steps[0].action", /Step 1 looks like it contains an API key\. Remove it/],
  "secret-github-token": ["error", "steps[0].action", /an API key/],
  "secret-aws-key": ["error", "steps[0].action", /an API key/],
  "secret-password": ["error", "steps[1].action", /Step 2 looks like it contains a password\. Remove it\. Claude should use the login already on that device\./],
  "secret-bearer-token": ["error", "steps[0].action", /a token/],
  "secret-private-key": ["error", "steps[0].action", /a private key/],
  "secret-url-password": ["error", "steps[0].action", /a password in a link/],
  "secret-in-expected-result": ["error", "steps[0].expected_result", /a token/],
  "secret-in-description": ["error", "description", /a password/],
  "warn-irreversible-no-never-automate": ["warning", "steps[1].reversible", /Step 2 cannot be undone\. Consider adding what Claude must never do\./],
  "warn-irreversible-empty-never-automate": ["warning", "steps[1].reversible", /cannot be undone/],
  "run-wrong-format": ["error", "format", /relay-run\/1/],
  "run-missing-run-id": ["error", "run_id", /needs a run id/],
  "run-bad-run-id": ["error", "run_id", /wrong shape/],
  "run-bad-commit": ["error", "workflow_commit", /wrong shape/],
  "run-email-as-started-by": ["error", "started_by", /wrong shape/],
  "run-bad-time": ["error", "started_at", /UTC time/],
  "run-bad-status": ["error", "status", /not allowed/],
  "run-bad-step-status": ["error", "steps[0].status", /Step 1/],
  "run-summary-too-long": ["error", "steps[0].summary", /too long.*2000/],
  "run-too-many-outputs": ["error", "steps[0].outputs", /at most 10/],
  "run-output-too-long": ["error", "steps[0].outputs.a", /too long.*500/],
  "run-output-not-string": ["error", "steps[0].outputs.a", /must be a string/],
  "run-unknown-field": ["error", "owner", /"owner" that relay-run\/1 does not know/],
  "run-secret-in-summary": ["error", "steps[0].summary", /an API key/],
  "run-secret-in-output": ["error", "steps[0].outputs.url", /a password in a link/],
};

describe("valid fixtures", () => {
  for (const f of files("valid")) {
    it(`${f} has no problems`, () => {
      const text = read(join(root, "valid", f));
      expect(check(f, text)).toEqual([]);
    });
    it(`${f} stringify(parse(x)) === x`, () => {
      const text = read(join(root, "valid", f));
      expect(stringify(parse(text))).toBe(text);
    });
  }
  it("demo day example is valid and canonical", () => {
    const text = read(demo);
    expect(validate(JSON.parse(text))).toEqual([]);
    expect(stringify(parse(text))).toBe(text);
  });
});

describe("invalid fixtures", () => {
  it("every invalid fixture has an expectation and the other way round", () => {
    expect(files("invalid").map((f) => f.replace(/\.json$/, ""))).toEqual(Object.keys(expected).sort());
  });
  for (const [name, [level, path, message]] of Object.entries(expected)) {
    it(`${name} reports ${level} at ${path}`, () => {
      const problems = check(name, read(join(root, "invalid", `${name}.json`)));
      const hit = problems.find((p) => p.path === path && p.level === level && message.test(p.message));
      expect(hit, JSON.stringify(problems, null, 1)).toBeDefined();
      if (level === "warning") expect(problems.every((p) => p.level === "warning")).toBe(true);
    });
  }
});

describe("rule coverage", () => {
  it("each warning-only fixture is runnable, each error fixture is not", () => {
    for (const [name, [level]] of Object.entries(expected)) {
      const problems = check(name, read(join(root, "invalid", `${name}.json`)));
      expect(problems.some((p) => p.level === "error")).toBe(level === "error");
    }
  });
  it("rejects non-objects", () => {
    expect(validate(null)[0]?.level).toBe("error");
    expect(validate([])[0]?.level).toBe("error");
    expect(validate("x")[0]?.message).toMatch(/JSON object/);
  });
  it("reports every problem, not just the first", () => {
    const p = validate({ format: "relay/1", name: "", purpose: "", steps: [{ id: "x" }] });
    expect(p.length).toBeGreaterThan(5);
  });
});

describe("stringify", () => {
  it("orders keys by schema, ends with newline, is stable", () => {
    const w = { steps: [{ reversible: "yes", expected_result: "e", needs: "none", role: "r", action: "a", order: 1, id: "s-1" }], purpose: "p", name: "n", format: "relay/1" } as never;
    const a = stringify(w);
    expect(a.endsWith("}\n")).toBe(true);
    expect(a.indexOf('"format"')).toBeLessThan(a.indexOf('"name"'));
    expect(a.indexOf('"id"')).toBeLessThan(a.indexOf('"reversible"'));
    expect(stringify(parse(a))).toBe(a);
    expect(a).toContain('\n  "name": "n",');
  });
  it("keeps unknown keys, sorted, after known ones", () => {
    const a = stringify({ format: "relay/1", zed: 1, alpha: 2, name: "n" } as never);
    expect(a.indexOf('"alpha"')).toBeLessThan(a.indexOf('"zed"'));
    expect(a.indexOf('"name"')).toBeLessThan(a.indexOf('"alpha"'));
  });
});
