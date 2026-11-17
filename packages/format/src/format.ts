import type { Run, Workflow } from "./types";
import { redact } from "./secrets";

const WORKFLOW_KEYS = ["format", "name", "purpose", "description", "tags", "inputs", "steps", "never_automate"];
const INPUT_KEYS = ["id", "what", "source", "sensitivity"];
const STEP_KEYS = ["id", "order", "action", "role", "needs", "expected_result", "reversible", "tools", "inputs_used", "approval"];
const RUN_KEYS = ["format", "run_id", "workflow_commit", "started_by", "started_at", "ended_at", "status", "note", "steps"];
const RUN_STEP_KEYS = ["id", "role", "device", "status", "approved_by", "started_at", "ended_at", "summary", "outputs"];

type Obj = Record<string, unknown>;

function order(value: unknown, keys: string[]): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const v = value as Obj;
  const out: Obj = {};
  for (const k of keys) if (v[k] !== undefined) out[k] = v[k];
  for (const k of Object.keys(v).sort()) if (!keys.includes(k) && v[k] !== undefined) out[k] = v[k];
  return out;
}

export function stringify(doc: Workflow | Run): string {
  const d = doc as unknown as Obj;
  const isRun = d.format === "relay-run/1";
  const top = order(d, isRun ? RUN_KEYS : WORKFLOW_KEYS) as Obj;
  if (Array.isArray(top.steps)) top.steps = top.steps.map((s) => order(s, isRun ? RUN_STEP_KEYS : STEP_KEYS));
  if (Array.isArray(top.inputs)) top.inputs = top.inputs.map((s) => order(s, INPUT_KEYS));
  return JSON.stringify(top, null, 2) + "\n";
}

export function parse(text: string): Workflow | Run {
  return JSON.parse(text) as Workflow | Run;
}

export function redactRun(run: Run): Run {
  return {
    ...run,
    ...(run.note !== undefined && { note: redact(run.note) }),
    steps: run.steps.map((s) => ({
      ...s,
      ...(s.summary !== undefined && { summary: redact(s.summary) }),
      ...(s.outputs !== undefined && {
        outputs: Object.fromEntries(Object.entries(s.outputs).map(([k, v]) => [k, redact(v)])),
      }),
    })),
  };
}
