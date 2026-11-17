import { afterEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { addStep, compact, createWorkflowDoc, docHash, docToJson, getDescription, getStepText, loadDoc, mergeUpdates, moveStep, PersistClient, setField, setMeta, shouldCompact } from "../src";
import { rng } from "./helpers";

afterEach(() => vi.useRealTimers());

const full = (d: Y.Doc) => Y.encodeStateAsUpdate(d);

function sample() {
  const d = createWorkflowDoc({ name: "Deploy", purpose: "ship" });
  const a = addStep(d, { action: "build" });
  const b = addStep(d, { action: "test", fields: { role: "ci" } });
  addStep(d, { afterId: null, action: "first" });
  moveStep(d, b, { beforeId: a });
  getDescription(d).insert(0, "long text");
  setMeta(d, "tags", ["x", "y"]);
  return d;
}

describe("persist helpers", () => {
  it("merge and compact keep content", () => {
    const d = sample();
    const ups: Uint8Array[] = [];
    const d2 = new Y.Doc();
    Y.applyUpdate(d2, full(d));
    d2.on("update", (u: Uint8Array) => ups.push(u));
    getStepText(d2, "s-1").insert(0, "do: ");
    setField(d2, "s-2", "role", "ops");
    const merged = mergeUpdates(full(d), ups);
    expect(docToJson(merged)).toEqual(docToJson(d2));
    const c = compact(merged);
    expect(docToJson(c)).toEqual(docToJson(d2));
    expect(c.length).toBeLessThanOrEqual(merged.length);
    expect(mergeUpdates(null, [])).toBeInstanceOf(Uint8Array);
    expect(docToJson(mergeUpdates(null, ups.slice(0, 0).concat(full(d))))).toEqual(docToJson(d));
  });

  it("compacts every 200 updates", () => {
    expect([0, 1, 199, 200, 201, 400].map(shouldCompact)).toEqual([false, false, false, true, false, true]);
  });

  it("docToJson sorts steps and hash tracks content", () => {
    const d = sample();
    const j = docToJson(d);
    expect(j.steps.map((s) => s.id)).toEqual(["s-3", "s-2", "s-1"]);
    expect(j.meta).toEqual({ name: "Deploy", purpose: "ship", description: "long text", tags: ["x", "y"] });
    expect(j.steps[1]).toMatchObject({ id: "s-2", role: "ci", action: "test" });
    const h = docHash(j);
    expect(docHash(docToJson(full(d)))).toBe(h);
    expect(docHash(docToJson(compact(full(d))))).toBe(h);
    setField(d, "s-1", "role", "other");
    expect(docHash(docToJson(d))).not.toBe(h);
    moveStep(d, "s-1", { afterId: null });
    expect(docToJson(d).steps[0]!.id).toBe("s-1");
  });

  it("concurrent persist posts merge without losing anything", () => {
    const base = sample();
    const baseUp = full(base);
    const r = rng(3);
    const clients = [0, 1, 2].map(() => {
      const d = loadDoc(baseUp);
      const ups: Uint8Array[] = [];
      d.on("update", (u: Uint8Array) => ups.push(u));
      return { d, ups };
    });
    clients.forEach(({ d }, i) => {
      for (let k = 0; k < 10; k++) {
        addStep(d, { id: `s-${i}${k}x` });
        getStepText(d, "s-1").insert(0, `${i}${k}`);
      }
      setField(d, "s-2", "role", `role${i}`);
    });
    let stored: Uint8Array | null = baseUp;
    const order = [0, 1, 2].sort(() => r() - 0.5);
    for (const i of order) stored = mergeUpdates(stored, clients[i]!.ups);
    stored = compact(stored);
    const result = loadDoc(stored);
    const all = loadDoc(baseUp);
    for (const c of clients) Y.applyUpdate(all, full(c.d));
    expect(docToJson(result)).toEqual(docToJson(all));
    expect(docToJson(result).steps).toHaveLength(33);
    for (const i of [0, 1, 2]) expect(getStepText(result, "s-1").toString()).toContain(`${i}9`);
  });
});

describe("PersistClient", () => {
  it("debounces by 1 second and posts one merged update", async () => {
    vi.useFakeTimers();
    const posts: Uint8Array[] = [];
    const d = createWorkflowDoc();
    const initial = full(d);
    const pc = new PersistClient({ doc: d, post: async (u) => void posts.push(u) });
    addStep(d);
    vi.advanceTimersByTime(900);
    addStep(d);
    vi.advanceTimersByTime(900);
    expect(posts).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(200);
    expect(posts).toHaveLength(1);
    expect(docToJson(mergeUpdates(initial, [posts[0]!])).steps).toHaveLength(2);
    expect(pc.hasPending).toBe(false);
  });

  it("ignores provider (remote) updates", async () => {
    vi.useFakeTimers();
    const posts: Uint8Array[] = [];
    const d = createWorkflowDoc();
    new PersistClient({ doc: d, post: async (u) => void posts.push(u) });
    const o = createWorkflowDoc();
    addStep(o);
    Y.applyUpdate(d, full(o), Symbol("provider"));
    await vi.advanceTimersByTimeAsync(2000);
    expect(posts).toHaveLength(0);
  });

  it("retries failures with backoff and keeps order without loss", async () => {
    vi.useFakeTimers();
    const received: Uint8Array[] = [];
    let fail = 2;
    let active = 0;
    let maxActive = 0;
    const d = createWorkflowDoc();
    const errors: number[] = [];
    const initial = full(d);
    const pc = new PersistClient({
      doc: d,
      retryBaseMs: 100,
      onError: (_e, n) => errors.push(n),
      post: async (u) => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 50));
        active--;
        if (fail-- > 0) throw new Error("down");
        received.push(u);
      },
    });
    addStep(d);
    await vi.advanceTimersByTimeAsync(1000);
    addStep(d);
    await vi.advanceTimersByTimeAsync(10000);
    expect(errors).toEqual([1, 2]);
    expect(maxActive).toBe(1);
    const stored = mergeUpdates(initial, received);
    expect(docToJson(loadDoc(stored))).toEqual(docToJson(d));
    expect(pc.hasPending).toBe(false);
  });

  it("flush sends immediately", async () => {
    const posts: Uint8Array[] = [];
    const d = createWorkflowDoc();
    const pc = new PersistClient({ doc: d, post: async (u) => void posts.push(u) });
    addStep(d);
    await pc.flush();
    expect(posts).toHaveLength(1);
    pc.destroy();
  });
});
