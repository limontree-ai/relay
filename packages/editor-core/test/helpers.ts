import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";

import { createProvider, type MemoryChannel, type MemoryHub, type ProviderOptions } from "../src";

export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function client(hub: MemoryHub, doc = new Y.Doc(), extra: Partial<ProviderOptions> = {}) {
  const awareness = new Awareness(doc);
  const channel: MemoryChannel = hub.createChannel();
  const statuses: string[] = [];
  const provider = createProvider({ doc, awareness, channel, onStatus: (s) => statuses.push(s), ...extra });
  return { doc, awareness, channel, provider, statuses };
}

const canon = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => [k, canon(x)])) : v;

export const snapshot = (d: Y.Doc) => JSON.stringify(canon([d.getMap("meta").toJSON(), d.getMap("steps").toJSON()]));
