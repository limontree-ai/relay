import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import { fromWorkflowJson, parse, sortedStepIds, stepIndexBetween, STEPS_MAP, stringify, toWorkflowJson, TOP_MAP, validate, type Workflow } from "../src";

const dir = join(__dirname, "..", "fixtures", "valid");
const valid = readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("run-"));
const load = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Workflow;
const full = () => load("full.json");

const clone = (d: Y.Doc) => {
  const c = new Y.Doc();
  Y.applyUpdate(c, Y.encodeStateAsUpdate(d));
  return c;
};
const sync = (a: Y.Doc, b: Y.Doc) => {
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
};

describe("round trip", () => {
  for (const f of valid)
    it(`${f} is lossless`, () => {
      const w = load(f);
      const back = toWorkflowJson(fromWorkflowJson(w));
      expect(back).toEqual(w);
      expect(stringify(back)).toBe(stringify(w));
    });
  it("survives encode and decode of the doc", () => {
    const w = full();
    expect(toWorkflowJson(clone(fromWorkflowJson(w)))).toEqual(w);
  });
  it("renumbers order 1..n sorted by index, even for shuffled input", () => {
    const w = full();
    w.steps = [{ ...w.steps[1]!, order: 1 }, { ...w.steps[0]!, order: 2 }];
    const back = toWorkflowJson(fromWorkflowJson(w));
    expect(back.steps.map((s) => [s.id, s.order])).toEqual([["s-2", 1], ["s-1", 2]]);
    expect(validate(back).filter((p) => p.level === "error")).toEqual([]);
  });
  it("uses the decided structure", () => {
    const d = fromWorkflowJson(full());
    const step = d.getMap<Y.Map<unknown>>(STEPS_MAP).get("s-1")!;
    expect(typeof step.get("index")).toBe("string");
    expect(step.get("action")).toBeInstanceOf(Y.Text);
    expect(d.getMap(TOP_MAP).get("description")).toBeInstanceOf(Y.Text);
    for (const k of ["role", "needs", "expected_result", "reversible"]) expect(typeof step.get(k)).toBe("string");
    expect(typeof d.getMap(TOP_MAP).get("name")).toBe("string");
    expect(step.has("order")).toBe(false);
  });
  it("keeps absent optional fields absent", () => {
    const back = toWorkflowJson(fromWorkflowJson(load("minimal.json")));
    expect(Object.keys(back)).toEqual(["format", "name", "purpose", "steps"]);
  });
});

describe("concurrent edits", () => {
  it("merges typing in the same action text", () => {
    const a = fromWorkflowJson(full());
    const b = clone(a);
    const ta = (d: Y.Doc) => d.getMap<Y.Map<unknown>>(STEPS_MAP).get("s-1")!.get("action") as Y.Text;
    ta(a).insert(0, "FIRST ");
    ta(b).insert(ta(b).length, " LAST");
    sync(a, b);
    const text = toWorkflowJson(a).steps[0]!.action;
    expect(text.startsWith("FIRST ")).toBe(true);
    expect(text.endsWith(" LAST")).toBe(true);
    expect(toWorkflowJson(b)).toEqual(toWorkflowJson(a));
  });
  it("merges edits to different fields and a name change", () => {
    const a = fromWorkflowJson(full());
    const b = clone(a);
    a.getMap<Y.Map<unknown>>(STEPS_MAP).get("s-2")!.set("role", "sam-pc");
    b.getMap(TOP_MAP).set("name", "Renamed");
    (b.getMap(TOP_MAP).get("description") as Y.Text).insert(0, "Hi. ");
    sync(a, b);
    const j = toWorkflowJson(a);
    expect(j.name).toBe("Renamed");
    expect(j.steps[1]!.role).toBe("sam-pc");
    expect(j.description!.startsWith("Hi. ")).toBe(true);
    expect(toWorkflowJson(b)).toEqual(j);
  });
  it("concurrent reorder and edit keep both", () => {
    const w = full();
    w.steps = [1, 2, 3].map((n) => ({ ...w.steps[0]!, id: `s-${n}`, order: n, action: `step ${n}`, inputs_used: undefined })) as never;
    const a = fromWorkflowJson(w);
    const b = clone(a);
    const move = (d: Y.Doc, id: string, after: string | null, before: string | null) =>
      d.getMap<Y.Map<unknown>>(STEPS_MAP).get(id)!.set("index", stepIndexBetween(d, after, before));
    move(a, "s-3", null, "s-1");
    ((b.getMap<Y.Map<unknown>>(STEPS_MAP).get("s-1")!.get("action")) as Y.Text).insert(0, "edited ");
    sync(a, b);
    for (const d of [a, b]) {
      expect(sortedStepIds(d)).toEqual(["s-3", "s-1", "s-2"]);
      const j = toWorkflowJson(d);
      expect(j.steps.map((s) => s.order)).toEqual([1, 2, 3]);
      expect(j.steps[1]!.action).toBe("edited step 1");
    }
  });
  it("two different steps moved at once converge to one order with no loss", () => {
    const w = full();
    w.steps = [1, 2, 3, 4].map((n) => ({ ...w.steps[0]!, id: `s-${n}`, order: n, action: `step ${n}`, inputs_used: undefined })) as never;
    const a = fromWorkflowJson(w);
    const b = clone(a);
    const move = (d: Y.Doc, id: string, after: string | null, before: string | null) =>
      d.getMap<Y.Map<unknown>>(STEPS_MAP).get(id)!.set("index", stepIndexBetween(d, after, before));
    move(a, "s-4", "s-1", "s-2");
    move(b, "s-1", "s-3", "s-4");
    sync(a, b);
    const ja = toWorkflowJson(a);
    expect(toWorkflowJson(b)).toEqual(ja);
    expect(ja.steps).toHaveLength(4);
    expect(new Set(ja.steps.map((s) => s.id)).size).toBe(4);
    expect(ja.steps.map((s) => s.id)).toEqual(["s-4", "s-2", "s-3", "s-1"]);
    expect(ja.steps.map((s) => s.order)).toEqual([1, 2, 3, 4]);
  });
  it("the same move on both sides ties are broken by id and converge", () => {
    const w = full();
    w.steps = [1, 2, 3].map((n) => ({ ...w.steps[0]!, id: `s-${n}`, order: n, inputs_used: undefined })) as never;
    const a = fromWorkflowJson(w);
    const b = clone(a);
    for (const [d, id] of [[a, "s-1"], [b, "s-2"]] as const)
      d.getMap<Y.Map<unknown>>(STEPS_MAP).get(id)!.set("index", stepIndexBetween(d, "s-2" === id ? "s-3" : null, null));
    sync(a, b);
    expect(sortedStepIds(a)).toEqual(sortedStepIds(b));
  });
  it("concurrent add of different steps and delete of another", () => {
    const a = fromWorkflowJson(full());
    const b = clone(a);
    const add = (d: Y.Doc, id: string) => {
      const m = new Y.Map<unknown>();
      m.set("index", stepIndexBetween(d, "s-2", null));
      m.set("action", new Y.Text(`new ${id}`));
      for (const [k, v] of Object.entries({ role: "dev", needs: "none", expected_result: "ok", reversible: "yes" })) m.set(k, v);
      d.getMap<Y.Map<unknown>>(STEPS_MAP).set(id, m);
    };
    add(a, "s-3");
    add(b, "s-4");
    b.getMap(STEPS_MAP).delete("s-1");
    sync(a, b);
    const j = toWorkflowJson(a);
    expect(j.steps.map((s) => s.id).sort()).toEqual(["s-2", "s-3", "s-4"]);
    expect(j.steps.map((s) => s.order)).toEqual([1, 2, 3]);
    expect(toWorkflowJson(b)).toEqual(j);
    expect(parse(stringify(j))).toEqual(j);
  });
});
