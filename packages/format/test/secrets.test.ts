import { describe, expect, it } from "vitest";
import { findSecrets, parse, redact, redactRun, stringify, validateRun, type Run } from "../src";

describe("redact", () => {
  const cases: [string, string, string][] = [
    ["anthropic key", "key sk-ant-api03-abcdefgh12345678 end", "key [redacted] end"],
    ["openai style key", "use sk-abcdefghijkl1234", "use [redacted]"],
    ["github token", "ghp_abcdefghijklmnopqrstuvwxyz0123456789 is mine", "[redacted] is mine"],
    ["slack token", "xox" + "b-1234567890-abcdefghij", "[redacted]"],
    ["aws key", "AKIAIOSFODNN7EXAMPLE", "[redacted]"],
    ["password", "password: hunter2hunter2, done", "password: [redacted], done"],
    ["password with =", "Password=s3cretvalue", "Password=[redacted]"],
    ["bearer", "Authorization: Bearer abcdEFGH1234567890xyzQ", "Authorization: Bearer [redacted]"],
    ["near word", "the api key is Zx81Kd92LmQp03VbNc77Rt55 ok", "the api key is [redacted] ok"],
    ["url password", "git clone https://bob:s3cr3tpass@host.com/r.git", "git clone https://bob:[redacted]@host.com/r.git"],
    ["private key block", "a\n-----BEGIN " + "PRIVATE KEY-----\nMIIabc\n-----END " + "PRIVATE KEY-----\nb", "a\n[redacted]\nb"],
    ["open private key", "-----BEGIN OPENSSH " + "PRIVATE KEY-----\nabc", "[redacted]"],
  ];
  for (const [name, input, out] of cases) it(name, () => expect(redact(input)).toBe(out));

  it("leaves normal text, placeholders and short values alone", () => {
    for (const t of [
      "Pulled main at 81ab2c0. 42 tests passed.",
      "password: {{PASSWORD}}",
      "password: <your password>",
      "the token field is empty",
      "https://github.com/team/app",
      "https://user@host.com/x",
      "task-runner-config-file",
      "api key is abcdefghijklmnopqrstuvwxyz",
    ])
      expect(redact(t)).toBe(t);
  });
  it("is idempotent", () => {
    const once = redact("password: hunter2hunter2 and sk-ant-abcdefgh1234");
    expect(redact(once)).toBe(once);
  });
  it("finds the exact span", () => {
    const t = "x password: abcdef12 y";
    const [m] = findSecrets(t);
    expect(t.slice(m!.start, m!.end)).toBe("abcdef12");
  });
  it("does not take the keyword when value equals it", () => {
    expect(redact("password=password")).toBe("password=[redacted]");
  });
});

describe("redactRun", () => {
  const run: Run = {
    format: "relay-run/1", run_id: "r7k2p9", workflow_commit: "3f9c1e2", started_by: "jaredc",
    started_at: "2026-11-16T21:30:05Z", ended_at: "2026-11-16T21:41:52Z", status: "succeeded",
    note: "password: hunter2hunter2",
    steps: [{ id: "s-1", role: "dev", status: "done", summary: "Used ghp_abcdefghijklmnopqrstuvwxyz0123456789.", outputs: { url: "https://a:b2c3d4@x.com", commit: "81ab2c0" } }],
  };
  it("masks note, summaries and outputs, and the result validates", () => {
    expect(validateRun(run).some((p) => p.level === "error")).toBe(true);
    const r = redactRun(run);
    expect(r.note).toBe("password: [redacted]");
    expect(r.steps[0]!.summary).toBe("Used [redacted].");
    expect(r.steps[0]!.outputs).toEqual({ url: "https://a:[redacted]@x.com", commit: "81ab2c0" });
    expect(validateRun(r)).toEqual([]);
    expect(run.note).toBe("password: hunter2hunter2");
    expect(stringify(parse(stringify(r)))).toBe(stringify(r));
  });
});
