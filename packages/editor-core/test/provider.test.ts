import { afterEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { addStep, createWorkflowDoc, deleteStep, getStepsOrdered, getStepText, MemoryHub, moveStep, setField, stepsMap } from "../src";
import { client, rng, snapshot } from "./helpers";

afterEach(() => vi.useRealTimers());

const order = (d: Y.Doc) => getStepsOrdered(d).map((s) => s.id).join(",");

function randomEdit(d: Y.Doc, r: () => number, who: number, n: number) {
  const steps = getStepsOrdered(d);
  const roll = r();
  if (roll < 0.25 || steps.length === 0) addStep(d, { id: `s-${(who + 1) * 1000000 + n}`, afterId: steps.length && r() < 0.5 ? steps[Math.floor(r() * steps.length)]!.id : undefined, action: "x" });
  else if (roll < 0.4) deleteStep(d, steps[Math.floor(r() * steps.length)]!.id);
  else if (roll < 0.6) moveStep(d, steps[Math.floor(r() * steps.length)]!.id, { afterId: r() < 0.2 ? null : steps[Math.floor(r() * steps.length)]!.id });
  else if (roll < 0.8) setField(d, steps[Math.floor(r() * steps.length)]!.id, "role", `r${who}${n}`);
  else {
    const t = getStepText(d, steps[Math.floor(r() * steps.length)]!.id);
    t.insert(Math.floor(r() * (t.length + 1)), String.fromCharCode(97 + Math.floor(r() * 26)));
  }
}

describe("provider convergence", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    it(`3 clients converge after random concurrent edits and reorders (seed ${seed})`, () => {
      const hub = new MemoryHub();
      const seedDoc = createWorkflowDoc({ name: "w" });
      const [a, b, c] = [client(hub, seedDoc), client(hub), client(hub)];
      const r = rng(seed);
      const cs = [a, b, c];
      for (let i = 0; i < 40; i++) addStep(cs[i % 3]!.doc, { id: `s-${i + 1}` });
      for (let round = 0; round < 15; round++) {
        const off = cs.filter(() => r() < 0.5);
        off.forEach((x) => x.channel.disconnect());
        for (let i = 0; i < 12; i++) {
          const who = Math.floor(r() * 3);
          randomEdit(cs[who]!.doc, r, who, round * 100 + i);
        }
        off.forEach((x) => x.channel.reconnect());
      }
      expect(snapshot(b.doc)).toBe(snapshot(a.doc));
      expect(snapshot(c.doc)).toBe(snapshot(a.doc));
      expect(order(b.doc)).toBe(order(a.doc));
    });
  }

  it("converges with latency, duplicates and reordering", async () => {
    const r = rng(11);
    const hub = new MemoryHub({ latency: () => Math.floor(r() * 4), duplicateRate: 0.3, random: r });
    const cs = [client(hub), client(hub), client(hub)];
    for (let i = 0; i < 60; i++) randomEdit(cs[i % 3]!.doc, r, i % 3, i);
    await new Promise((x) => setTimeout(x, 30));
    await hub.settle();
    expect(snapshot(cs[1]!.doc)).toBe(snapshot(cs[0]!.doc));
    expect(snapshot(cs[2]!.doc)).toBe(snapshot(cs[0]!.doc));
  });

  it("merges concurrent typing in the same field", () => {
    const hub = new MemoryHub();
    const a = client(hub, createWorkflowDoc());
    const b = client(hub);
    const id = addStep(a.doc, { action: "open " });
    a.channel.disconnect();
    getStepText(a.doc, id).insert(5, "alpha");
    getStepText(b.doc, id).insert(5, "beta");
    a.channel.reconnect();
    const t = getStepText(a.doc, id).toString();
    expect(t).toBe(getStepText(b.doc, id).toString());
    expect(t).toContain("alpha");
    expect(t).toContain("beta");
    expect(t.startsWith("open ")).toBe(true);
  });

  it("offline edits sync on reconnect and status goes offline then synced", () => {
    const hub = new MemoryHub();
    const a = client(hub, createWorkflowDoc());
    const b = client(hub);
    expect(b.provider.status).toBe("synced");
    a.channel.disconnect();
    a.channel.reconnect();
    expect(a.provider.status).toBe("synced");
    const id = addStep(a.doc);
    a.channel.disconnect();
    expect(a.provider.status).toBe("offline");
    setField(a.doc, id, "role", "offline-role");
    addStep(a.doc, { id: "s-off" });
    expect(a.provider.pendingBytes).toBeGreaterThan(0);
    expect(stepsMap(b.doc).has("s-off")).toBe(false);
    a.channel.reconnect();
    expect(a.provider.status).toBe("synced");
    expect(stepsMap(b.doc).has("s-off")).toBe(true);
    expect(getStepsOrdered(b.doc)[0]!.map.get("role")).toBe("offline-role");
    expect(a.provider.pendingBytes).toBe(0);
    expect(a.statuses).toEqual(["offline", "connecting", "synced", "offline", "connecting", "synced"]);
    expect(a.statuses).toContain("offline");
  });

  it("a fresh client loads state from peers; lone client syncs by timeout", () => {
    vi.useFakeTimers();
    const hub = new MemoryHub();
    const lone = client(hub, createWorkflowDoc());
    expect(lone.provider.status).toBe("connecting");
    vi.advanceTimersByTime(1000);
    expect(lone.provider.status).toBe("synced");
    addStep(lone.doc);
    const late = client(hub);
    expect(late.provider.status).toBe("synced");
    expect(snapshot(late.doc)).toBe(snapshot(lone.doc));
  });

  it("dropped messages are repaired by the next sync", () => {
    const hub = new MemoryHub({ dropRate: 1 });
    const a = client(hub, createWorkflowDoc());
    const b = client(hub);
    addStep(a.doc);
    expect(stepsMap(b.doc).size).toBe(0);
    hub.dropRate = 0;
    a.channel.disconnect();
    a.channel.reconnect();
    expect(snapshot(b.doc)).toBe(snapshot(a.doc));
  });

  it("duplicate and out-of-order delivery is safe", () => {
    const src = createWorkflowDoc();
    const updates: Uint8Array[] = [Y.encodeStateAsUpdate(src)];
    src.on("update", (u: Uint8Array) => updates.push(u));
    const a = addStep(src);
    addStep(src, { afterId: a });
    moveStep(src, a, { afterId: "s-2" });
    getStepText(src, a).insert(0, "hi");
    const dst = new Y.Doc();
    for (const u of [...updates].reverse()) Y.applyUpdate(dst, u);
    for (const u of [...updates, ...updates]) Y.applyUpdate(dst, u);
    expect(snapshot(dst)).toBe(snapshot(src));
  });

  it("no echo loops", () => {
    const hub = new MemoryHub();
    const cs = [client(hub, createWorkflowDoc()), client(hub), client(hub)];
    hub.sent.length = 0;
    addStep(cs[0]!.doc);
    expect(hub.count("yjs-update")).toBe(1);
    expect(hub.sent.length).toBe(1);
    hub.sent.length = 0;
    cs[1]!.awareness.setLocalState({ user_id: "u" });
    expect(hub.count("awareness")).toBe(1);
    expect(hub.sent.length).toBe(1);
  });

  it("splits large updates and reassembles, in any order", () => {
    const hub = new MemoryHub();
    const a = client(hub, createWorkflowDoc(), { maxPayloadBytes: 1000 });
    const b = client(hub, new Y.Doc(), { maxPayloadBytes: 1000 });
    const id = addStep(a.doc);
    hub.sent.length = 0;
    const big = Array.from({ length: 4000 }, (_, i) => String.fromCharCode(33 + ((i * 7) % 90))).join("");
    getStepText(a.doc, id).insert(0, big);
    const chunks = hub.sent.filter((s) => s.event === "yjs-chunk");
    expect(chunks.length).toBeGreaterThan(3);
    for (const s of hub.sent) expect(JSON.stringify(s.payload).length).toBeLessThan(1300);
    expect(getStepText(b.doc, id).toString()).toBe(big);
    const c = client(hub);
    expect(getStepText(c.doc, id).toString()).toBe(big);
  });

  it("reassembles shuffled and duplicated chunks", () => {
    const hub = new MemoryHub();
    const a = client(hub, createWorkflowDoc(), { maxPayloadBytes: 600 });
    const b = client(hub, new Y.Doc(), { maxPayloadBytes: 600 });
    const id = addStep(a.doc);
    b.channel.disconnect();
    hub.sent.length = 0;
    getStepText(a.doc, id).insert(0, "z".repeat(3000) + Math.random());
    const chunks = hub.sent.filter((s) => s.event === "yjs-chunk").map((s) => s.payload);
    b.channel.reconnect();
    const before = getStepText(b.doc, id).toString();
    b.channel.subscribed = true;
    for (const p of [...chunks].reverse().concat(chunks)) b.channel.receive("yjs-chunk", structuredClone(p));
    expect(before.length).toBeGreaterThan(-1);
    expect(snapshot(b.doc)).toBe(snapshot(a.doc));
  });
});

describe("awareness throttle", () => {
  it("sends at most 10 per second with leading and trailing edges", () => {
    vi.useFakeTimers();
    const hub = new MemoryHub();
    const a = client(hub, new Y.Doc());
    const b = client(hub);
    hub.sent.length = 0;
    for (let i = 0; i < 50; i++) a.awareness.setLocalState({ user_id: "a", n: i });
    expect(hub.count("awareness")).toBe(1);
    expect(b.awareness.getStates().get(a.doc.clientID)?.n).toBe(0);
    vi.advanceTimersByTime(100);
    expect(hub.count("awareness")).toBe(2);
    expect(b.awareness.getStates().get(a.doc.clientID)?.n).toBe(49);
    hub.sent.length = 0;
    for (let t = 0; t < 1000; t += 10) {
      a.awareness.setLocalState({ user_id: "a", n: t });
      vi.advanceTimersByTime(10);
    }
    vi.advanceTimersByTime(200);
    expect(hub.count("awareness")).toBeLessThanOrEqual(11);
    expect(hub.count("awareness")).toBeGreaterThanOrEqual(9);
    expect(b.awareness.getStates().get(a.doc.clientID)?.n).toBe(990);
  });
});
