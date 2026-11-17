import * as Y from "yjs";

import { getStepsOrdered, metaMap } from "./model";

export const COMPACT_EVERY = 200;

export function mergeUpdates(existing: Uint8Array | null, incoming: Uint8Array[]): Uint8Array {
  const all = existing ? [existing, ...incoming] : incoming;
  return all.length ? Y.mergeUpdates(all) : Y.encodeStateAsUpdate(new Y.Doc());
}

export function loadDoc(update: Uint8Array | null): Y.Doc {
  const doc = new Y.Doc();
  if (update) Y.applyUpdate(doc, update);
  return doc;
}

export function compact(update: Uint8Array): Uint8Array {
  const doc = loadDoc(update);
  const out = Y.encodeStateAsUpdate(doc);
  doc.destroy();
  return out;
}

export const shouldCompact = (count: number) => count > 0 && count % COMPACT_EVERY === 0;

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

export interface WorkflowJson {
  meta: Record<string, Json>;
  steps: ({ id: string } & Record<string, Json>)[];
}

const plain = (v: unknown): Json => {
  if (v instanceof Y.Text) return v.toString();
  if (v instanceof Y.AbstractType) return v.toJSON() as Json;
  return (v ?? null) as Json;
};

export function docToJson(update: Uint8Array | Y.Doc): WorkflowJson {
  const doc = update instanceof Y.Doc ? update : loadDoc(update);
  const meta: Record<string, Json> = {};
  metaMap(doc).forEach((v, k) => {
    if (k !== "next_step") meta[k] = plain(v);
  });
  const steps = getStepsOrdered(doc).map(({ id, map }) => {
    const s: { id: string } & Record<string, Json> = { id };
    map.forEach((v, k) => {
      if (k !== "index") s[k] = plain(v);
    });
    return s;
  });
  return { meta, steps };
}

const stable = (v: Json): string =>
  Array.isArray(v)
    ? `[${v.map(stable).join(",")}]`
    : v && typeof v === "object"
      ? `{${Object.keys(v)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${stable(v[k]!)}`)
          .join(",")}}`
      : JSON.stringify(v);

export function docHash(json: WorkflowJson | Json): string {
  const s = stable(json as Json);
  let h1 = 0xdeadbeef,
    h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}

export interface PersistClientOptions {
  doc: Y.Doc;
  post: (update: Uint8Array) => Promise<unknown>;
  debounceMs?: number;
  retryBaseMs?: number;
  retryMaxMs?: number;
  ignoreOrigin?: (origin: unknown) => boolean;
  onError?: (err: unknown, attempt: number) => void;
}

/** Sends local updates one batch at a time, in order. Remote updates are skipped because their author persists them. */
export class PersistClient {
  private pending: Uint8Array | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private inflight: Promise<void> | null = null;
  private attempt = 0;
  private dead = false;
  private readonly o: Required<Omit<PersistClientOptions, "onError">> & { onError?: PersistClientOptions["onError"] };

  constructor(opts: PersistClientOptions) {
    this.o = { debounceMs: 1000, retryBaseMs: 500, retryMaxMs: 30000, ignoreOrigin: (x) => typeof x === "symbol", ...opts };
    this.o.doc.on("update", this.onUpdate);
  }

  get hasPending() {
    return this.pending !== null || this.inflight !== null;
  }

  private onUpdate = (u: Uint8Array, origin: unknown) => {
    if (this.dead || this.o.ignoreOrigin(origin)) return;
    this.pending = this.pending ? Y.mergeUpdates([this.pending, u]) : u;
    if (this.inflight) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.run(), this.o.debounceMs);
  };

  private run(): Promise<void> {
    this.inflight ??= this.drain().finally(() => (this.inflight = null));
    return this.inflight;
  }

  private async drain() {
    while (this.pending && !this.dead) {
      const batch = this.pending;
      this.pending = null;
      try {
        await this.o.post(batch);
        this.attempt = 0;
      } catch (err) {
        this.pending = this.pending ? Y.mergeUpdates([batch, this.pending]) : batch;
        this.o.onError?.(err, ++this.attempt);
        await new Promise((r) => setTimeout(r, Math.min(this.o.retryMaxMs, this.o.retryBaseMs * 2 ** (this.attempt - 1))));
      }
    }
  }

  async flush() {
    clearTimeout(this.timer);
    if (this.pending || this.inflight) await this.run();
  }

  destroy() {
    this.dead = true;
    clearTimeout(this.timer);
    this.o.doc.off("update", this.onUpdate);
  }
}
