import * as Y from "yjs";
import { compareKeys, generateNKeysBetween } from "./index-key";
import type { Workflow, WorkflowStep } from "./types";

export const TOP_MAP = "workflow";
export const STEPS_MAP = "steps";

const TOP_PLAIN = ["format", "name", "purpose", "tags", "inputs", "never_automate"] as const;
const STEP_PLAIN = ["role", "needs", "expected_result", "reversible", "tools", "inputs_used", "approval"] as const;

export function fromWorkflowJson(json: Workflow, doc: Y.Doc = new Y.Doc()): Y.Doc {
  doc.transact(() => {
    const top = doc.getMap(TOP_MAP);
    const steps = doc.getMap<Y.Map<unknown>>(STEPS_MAP);
    const src = json as unknown as Record<string, unknown>;
    for (const k of TOP_PLAIN) if (src[k] !== undefined) top.set(k, structuredClone(src[k]));
    if (json.description !== undefined) top.set("description", new Y.Text(json.description));
    const sorted = [...json.steps].sort((a, b) => a.order - b.order);
    const keys = generateNKeysBetween(null, null, sorted.length);
    sorted.forEach((s, i) => {
      const m = new Y.Map<unknown>();
      const rec = s as unknown as Record<string, unknown>;
      m.set("index", keys[i]);
      m.set("action", new Y.Text(s.action));
      for (const k of STEP_PLAIN) if (rec[k] !== undefined) m.set(k, structuredClone(rec[k]));
      steps.set(s.id, m);
    });
  });
  return doc;
}

export function sortedStepIds(doc: Y.Doc): string[] {
  const steps = doc.getMap<Y.Map<unknown>>(STEPS_MAP);
  return [...steps.keys()].sort((a, b) =>
    compareKeys(String(steps.get(a)?.get("index") ?? ""), String(steps.get(b)?.get("index") ?? "")) || compareKeys(a, b),
  );
}

export function toWorkflowJson(doc: Y.Doc): Workflow {
  const top = doc.getMap(TOP_MAP);
  const steps = doc.getMap<Y.Map<unknown>>(STEPS_MAP);
  const out: Record<string, unknown> = {};
  const plain = (m: Y.Map<unknown>, k: string) => {
    const v = m.get(k);
    return v === undefined ? undefined : structuredClone(v);
  };
  const put = (o: Record<string, unknown>, k: string, v: unknown) => {
    if (v !== undefined) o[k] = v;
  };
  put(out, "format", plain(top, "format"));
  put(out, "name", plain(top, "name"));
  put(out, "purpose", plain(top, "purpose"));
  const d = top.get("description");
  if (d !== undefined) out.description = d instanceof Y.Text ? d.toString() : d;
  put(out, "tags", plain(top, "tags"));
  put(out, "inputs", plain(top, "inputs"));
  out.steps = sortedStepIds(doc).map((id, i) => {
    const m = steps.get(id)!;
    const s: Record<string, unknown> = { id, order: i + 1 };
    const a = m.get("action");
    s.action = a instanceof Y.Text ? a.toString() : (a ?? "");
    for (const k of STEP_PLAIN) put(s, k, plain(m, k));
    return s as unknown as WorkflowStep;
  });
  put(out, "never_automate", plain(top, "never_automate"));
  return out as unknown as Workflow;
}

export function stepIndexBetween(doc: Y.Doc, before: string | null, after: string | null): string {
  const steps = doc.getMap<Y.Map<unknown>>(STEPS_MAP);
  const idx = (id: string | null) => (id === null ? null : ((steps.get(id)?.get("index") as string | undefined) ?? null));
  return generateNKeysBetween(idx(before), idx(after), 1)[0]!;
}
