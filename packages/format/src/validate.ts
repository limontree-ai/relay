import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
import workflowSchema from "../schemas/workflow.schema.json";
import runSchema from "../schemas/run.schema.json";
import { findSecrets, secretLabel } from "./secrets";
import type { Problem } from "./types";

const ajv = new Ajv2020({ allErrors: true, strict: true });
const checkWorkflow = ajv.compile(workflowSchema);
const checkRun = ajv.compile(runSchema);

export const MAX_STEPS = 30;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

const fieldName: Record<string, string> = {
  name: "name",
  purpose: "purpose",
  description: "description",
  tags: "tags",
  inputs: "inputs",
  steps: "steps",
  never_automate: "never_automate list",
  what: "description of what it is",
  source: "source",
  sensitivity: "sensitivity",
  action: "action",
  role: "role",
  needs: "needs",
  expected_result: "description of what done looks like",
  reversible: "reversible setting",
  tools: "tools list",
  inputs_used: "inputs_used list",
  approval: "approval setting",
  run_id: "run id",
  workflow_commit: "workflow commit",
  started_by: "started_by",
  started_at: "start time",
  ended_at: "end time",
  status: "status",
  summary: "summary",
  outputs: "outputs",
  note: "note",
  device: "device",
  approved_by: "approved_by",
  id: "id",
};

const hints: Record<string, string> = {
  id: "Use s- and digits, like s-1.",
  role: "Use lowercase letters, digits and dashes, up to 32 characters, like jared-mac.",
  needs: "Use none, shell, browser or screen.",
  reversible: "Use yes, no or unsure.",
  approval: "Only each is allowed in relay/1.",
  sensitivity: "Use public, internal, confidential or restricted.",
  status: "Use one of the allowed values.",
  started_at: "Use a UTC time like 2026-11-16T21:30:05Z.",
  ended_at: "Use a UTC time like 2026-11-16T21:30:05Z.",
};

function toPath(ptr: string): string {
  return ptr.replace(/\/(\d+)/g, "[$1]").replace(/\//g, ".").replace(/^\./, "");
}

function subject(segs: string[]): { who: string; field: string } {
  const field = [...segs].reverse().find((s) => !/^\d+$/.test(s)) ?? "";
  const stepAt = segs.indexOf("steps");
  const inputAt = segs.indexOf("inputs");
  const num = (i: number) => Number(segs[i + 1]) + 1;
  if (stepAt >= 0 && /^\d+$/.test(segs[stepAt + 1] ?? "")) return { who: `Step ${num(stepAt)}`, field };
  if (inputAt >= 0 && /^\d+$/.test(segs[inputAt + 1] ?? "")) return { who: `Input ${num(inputAt)}`, field };
  return { who: "The file", field };
}

function translate(e: ErrorObject, kind: "workflow" | "run"): Problem {
  const base = e.instancePath.split("/").slice(1);
  const segs = e.keyword === "required" ? [...base, String(e.params.missingProperty)] : base;
  const { who, field } = subject(segs);
  const label = fieldName[field] ?? field;
  const owner = who === "The file" ? "The workflow" : who;
  const hint = hints[field] ? ` ${hints[field]}` : "";
  const path = toPath(segs.map((s) => `/${s}`).join("")) || "$";
  let message: string;
  switch (e.keyword) {
    case "required":
      message =
        field === "expected_result"
          ? `${who} needs a description of what done looks like.`
          : `${who === "The file" ? "The file" : who} needs ${/^[aeiou]/.test(label) ? "an" : "a"} ${label}.`;
      break;
    case "additionalProperties": {
      const extra = String(e.params.additionalProperty);
      const fmt = kind === "workflow" ? "relay/1" : "relay-run/1";
      const where = who === "The file" ? "This file" : who;
      message = `${where} has a field called "${extra}" that ${fmt} does not know. Remove it.`;
      return { path: toPath(base.map((s) => `/${s}`).join("") + `/${extra}`), message, level: "error" };
    }
    case "const":
      message =
        field === "format"
          ? `The format must be "${e.params.allowedValue}". This reader does not understand other formats.`
          : `${who} ${label} must be "${e.params.allowedValue}".${hint}`;
      break;
    case "enum":
      message = `${who} has an ${label} that is not allowed.${hint}`;
      break;
    case "minLength":
      message = `${who} needs ${/^[aeiou]/.test(label) ? "an" : "a"} ${label}. It cannot be empty.`;
      break;
    case "maxLength":
      message = `${who} ${label} is too long. The limit is ${e.params.limit} characters.`;
      break;
    case "pattern":
      message = `${who} has an ${label} in the wrong shape.${hint}`;
      break;
    case "minItems":
      message = field === "steps" ? "A workflow needs at least one step." : `The ${label} needs at least ${e.params.limit} items.`;
      break;
    case "maxItems":
      message =
        field === "steps"
          ? `A workflow can have at most ${MAX_STEPS} steps.`
          : `${owner} can have at most ${e.params.limit} ${field === "tags" ? "tags" : "items in the " + label}.`;
      break;
    case "maxProperties":
      message = `${who} can have at most ${e.params.limit} outputs.`;
      break;
    case "type":
      message = `${who === "The file" && !field ? "The file" : who} ${label || "value"} must be ${e.params.type === "integer" ? "a whole number" : "a " + e.params.type}.`;
      break;
    case "minimum":
      message = `${who} ${label} must be at least ${e.params.limit}.`;
      break;
    default:
      message = `${who} ${label}: ${e.message ?? "is not valid"}.`;
  }
  return { path, message, level: "error" };
}

function schemaProblems(json: unknown, kind: "workflow" | "run"): Problem[] {
  const check = kind === "workflow" ? checkWorkflow : checkRun;
  if (check(json)) return [];
  const seen = new Set<string>();
  const out: Problem[] = [];
  for (const e of check.errors ?? []) {
    if (e.keyword === "if") continue;
    const p = translate(e, kind);
    const key = p.path + p.message;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(p);
    }
  }
  return out;
}

function secretProblems(text: unknown, path: string, who: string, out: Problem[]) {
  if (typeof text !== "string") return;
  const kinds = new Set(findSecrets(text).map((m) => m.kind));
  for (const k of kinds)
    out.push({
      path,
      message: `${who} looks like it contains ${secretLabel[k]}. Remove it. Claude should use the login already on that device.`,
      level: "error",
    });
}

export function validate(json: unknown): Problem[] {
  if (!isObj(json)) return [{ path: "$", message: "The workflow file must be a JSON object.", level: "error" }];
  const out = schemaProblems(json, "workflow");
  const steps = Array.isArray(json.steps) ? json.steps.filter(isObj) : [];
  const list = Array.isArray(json.steps) ? json.steps : [];

  const ids = new Map<string, number[]>();
  const orders = new Map<number, number[]>();
  list.forEach((s, i) => {
    if (!isObj(s)) return;
    if (typeof s.id === "string") ids.set(s.id, [...(ids.get(s.id) ?? []), i]);
    if (typeof s.order === "number") orders.set(s.order, [...(orders.get(s.order) ?? []), i]);
  });
  for (const [id, at] of ids)
    if (at.length > 1) out.push({ path: `steps[${at[1]}].id`, message: `Two steps share the id ${id}.`, level: "error" });
  for (const [order, at] of orders)
    if (at.length > 1) out.push({ path: `steps[${at[1]}].order`, message: `Two steps share the order number ${order}.`, level: "error" });
  if (steps.length === list.length && orders.size === list.length && list.every((s) => isObj(s) && Number.isInteger(s.order))) {
    list.forEach((s, i) => {
      const o = (s as Obj).order as number;
      if (o !== i + 1 && !(orders.get(o)!.length > 1))
        out.push({
          path: `steps[${i}].order`,
          message: `Step ${i + 1} has order number ${o}. Orders must go 1, 2, 3 in the order listed, with no gaps.`,
          level: "error",
        });
    });
  }

  const inputIds = new Set<string>();
  const inputList = Array.isArray(json.inputs) ? json.inputs : [];
  inputList.forEach((inp, i) => {
    if (!isObj(inp) || typeof inp.id !== "string") return;
    if (inputIds.has(inp.id)) out.push({ path: `inputs[${i}].id`, message: `Two inputs share the id ${inp.id}.`, level: "error" });
    inputIds.add(inp.id);
  });

  const never = Array.isArray(json.never_automate) && json.never_automate.some((x) => typeof x === "string" && x.trim());

  list.forEach((s, i) => {
    if (!isObj(s)) return;
    const who = `Step ${i + 1}`;
    if (Array.isArray(s.inputs_used))
      for (const u of s.inputs_used)
        if (typeof u === "string" && !inputIds.has(u))
          out.push({ path: `steps[${i}].inputs_used`, message: `${who} uses an input called ${u} that does not exist.`, level: "error" });
    secretProblems(s.action, `steps[${i}].action`, who, out);
    secretProblems(s.expected_result, `steps[${i}].expected_result`, who, out);
    if (Array.isArray(s.tools)) s.tools.forEach((t, j) => secretProblems(t, `steps[${i}].tools[${j}]`, who, out));
    if (s.reversible === "no" && !never)
      out.push({
        path: `steps[${i}].reversible`,
        message: `${who} cannot be undone. Consider adding what Claude must never do.`,
        level: "warning",
      });
  });

  secretProblems(json.purpose, "purpose", "The purpose", out);
  secretProblems(json.description, "description", "The description", out);
  if (Array.isArray(json.never_automate)) json.never_automate.forEach((t, i) => secretProblems(t, `never_automate[${i}]`, "A never_automate entry", out));
  inputList.forEach((inp, i) => {
    if (!isObj(inp)) return;
    secretProblems(inp.what, `inputs[${i}].what`, `Input ${i + 1}`, out);
    secretProblems(inp.source, `inputs[${i}].source`, `Input ${i + 1}`, out);
  });
  return out;
}

export function validateRun(json: unknown): Problem[] {
  if (!isObj(json)) return [{ path: "$", message: "The run file must be a JSON object.", level: "error" }];
  const out = schemaProblems(json, "run");
  secretProblems(json.note, "note", "The note", out);
  if (Array.isArray(json.steps))
    json.steps.forEach((s, i) => {
      if (!isObj(s)) return;
      const who = `Step ${i + 1}`;
      secretProblems(s.summary, `steps[${i}].summary`, who, out);
      if (isObj(s.outputs)) for (const [k, v] of Object.entries(s.outputs)) secretProblems(v, `steps[${i}].outputs.${k}`, who, out);
    });
  return out;
}

export const hasErrors = (problems: Problem[]) => problems.some((p) => p.level === "error");
