import * as Y from "yjs";

import { generateKeyBetween } from "./fractional-index";

export const STEP_FIELDS = ["role", "needs", "expected_result", "reversible", "approval"] as const;
export type StepField = (typeof STEP_FIELDS)[number];
export type StepTextField = "action";

export interface StepRef {
  id: string;
  index: string;
  map: Y.Map<unknown>;
}

export const metaMap = (doc: Y.Doc) => doc.getMap<unknown>("meta");
export const stepsMap = (doc: Y.Doc) => doc.getMap<Y.Map<unknown>>("steps");

export function createWorkflowDoc(init: { name?: string; purpose?: string } = {}): Y.Doc {
  const doc = new Y.Doc();
  doc.transact(() => {
    const meta = metaMap(doc);
    meta.set("name", init.name ?? "");
    meta.set("purpose", init.purpose ?? "");
    meta.set("description", new Y.Text());
    meta.set("tags", []);
  });
  return doc;
}

export function setMeta(doc: Y.Doc, key: string, value: string | string[]) {
  metaMap(doc).set(key, value);
}

export function getDescription(doc: Y.Doc): Y.Text {
  const meta = metaMap(doc);
  let t = meta.get("description");
  if (!(t instanceof Y.Text)) {
    t = new Y.Text();
    meta.set("description", t);
  }
  return t as Y.Text;
}

const idNum = (id: string) => {
  const m = /^s-(\d+)$/.exec(id);
  return m ? Number(m[1]) : 0;
};

export function getStepsOrdered(doc: Y.Doc): StepRef[] {
  const out: StepRef[] = [];
  stepsMap(doc).forEach((map, id) => out.push({ id, index: String(map.get("index") ?? ""), map }));
  return out.sort((a, b) => (a.index < b.index ? -1 : a.index > b.index ? 1 : a.id < b.id ? -1 : 1));
}

export function nextStepId(doc: Y.Doc): string {
  let max = Number(metaMap(doc).get("next_step") ?? 0);
  stepsMap(doc).forEach((_, id) => (max = Math.max(max, idNum(id))));
  return `s-${max + 1}`;
}

function neighbours(doc: Y.Doc, afterId: string | null | undefined, exclude?: string) {
  const list = getStepsOrdered(doc).filter((s) => s.id !== exclude);
  if (afterId === undefined) return { lo: list.at(-1)?.index ?? null, hi: null };
  if (afterId === null) return { lo: null, hi: list[0]?.index ?? null };
  const i = list.findIndex((s) => s.id === afterId);
  if (i < 0) throw new Error(`unknown step ${afterId}`);
  return { lo: list[i]!.index, hi: list[i + 1]?.index ?? null };
}

function between(lo: string | null, hi: string | null) {
  return lo !== null && hi !== null && lo >= hi ? generateKeyBetween(lo, null) : generateKeyBetween(lo, hi);
}

export interface AddStepOptions {
  afterId?: string | null;
  id?: string;
  fields?: Partial<Record<StepField, string>>;
  action?: string;
}

/** afterId: undefined appends, null prepends, otherwise inserts after that step */
export function addStep(doc: Y.Doc, opts: AddStepOptions = {}): string {
  let id = "";
  doc.transact(() => {
    id = opts.id ?? nextStepId(doc);
    if (stepsMap(doc).has(id)) throw new Error(`step ${id} exists`);
    const { lo, hi } = neighbours(doc, opts.afterId);
    const step = new Y.Map<unknown>();
    step.set("index", between(lo, hi));
    for (const f of STEP_FIELDS) step.set(f, opts.fields?.[f] ?? "");
    step.set("action", new Y.Text(opts.action ?? ""));
    stepsMap(doc).set(id, step);
    metaMap(doc).set("next_step", Math.max(Number(metaMap(doc).get("next_step") ?? 0), idNum(id)));
  });
  return id;
}

export function deleteStep(doc: Y.Doc, id: string) {
  stepsMap(doc).delete(id);
}

export function moveStep(doc: Y.Doc, id: string, target: { afterId: string | null } | { beforeId: string }) {
  if (("afterId" in target ? target.afterId : target.beforeId) === id) return;
  doc.transact(() => {
    const step = stepsMap(doc).get(id);
    if (!step) throw new Error(`unknown step ${id}`);
    let lo: string | null, hi: string | null;
    if ("beforeId" in target) {
      const list = getStepsOrdered(doc).filter((s) => s.id !== id);
      const i = list.findIndex((s) => s.id === target.beforeId);
      if (i < 0) throw new Error(`unknown step ${target.beforeId}`);
      lo = list[i - 1]?.index ?? null;
      hi = list[i]!.index;
    } else ({ lo, hi } = neighbours(doc, target.afterId, id));
    step.set("index", between(lo, hi));
  });
}

export function setField(doc: Y.Doc, id: string, field: StepField, value: string) {
  const step = stepsMap(doc).get(id);
  if (!step) throw new Error(`unknown step ${id}`);
  step.set(field, value);
}

export function getStepText(doc: Y.Doc, id: string): Y.Text {
  const step = stepsMap(doc).get(id);
  if (!step) throw new Error(`unknown step ${id}`);
  let t = step.get("action");
  if (!(t instanceof Y.Text)) {
    t = new Y.Text();
    step.set("action", t);
  }
  return t as Y.Text;
}
