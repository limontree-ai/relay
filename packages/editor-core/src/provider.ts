import * as Y from "yjs";
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness";
import { fromBase64, toBase64 } from "lib0/buffer";

import type { BroadcastChannelLike, ChannelStatus } from "./channel";

export type ProviderStatus = "connecting" | "synced" | "offline";

export interface ProviderOptions {
  doc: Y.Doc;
  awareness: Awareness;
  channel: BroadcastChannelLike;
  onStatus?: (status: ProviderStatus) => void;
  maxPayloadBytes?: number;
  awarenessIntervalMs?: number;
  syncTimeoutMs?: number;
}

export interface Provider {
  readonly status: ProviderStatus;
  readonly pendingBytes: number;
  destroy(): void;
}

const emptyUpdate = (u: Uint8Array) => u.length <= 2;

export function createProvider(opts: ProviderOptions): Provider {
  const { doc, awareness, channel } = opts;
  const maxPayload = opts.maxPayloadBytes ?? 200 * 1024;
  const awIntervalMs = opts.awarenessIntervalMs ?? 100;
  const syncTimeoutMs = opts.syncTimeoutMs ?? 1000;
  const origin = Symbol("relay-provider");
  const chunkRaw = Math.max(16, Math.floor((maxPayload * 3) / 4) - 64);

  let status: ProviderStatus = "connecting";
  let subscribed = false;
  let destroyed = false;
  let pending: Uint8Array | null = null;
  let syncTimer: ReturnType<typeof setTimeout> | undefined;
  let seq = 0;
  const sessionId = Math.random().toString(36).slice(2, 8);
  const chunks = new Map<string, { parts: (Uint8Array | undefined)[]; got: number }>();
  const done = new Set<string>();

  const setStatus = (s: ProviderStatus) => {
    if (s === status) return;
    status = s;
    opts.onStatus?.(s);
  };

  const raw = (event: string, payload: unknown) => {
    try {
      const r = channel.send(event, payload);
      if (r && typeof (r as Promise<unknown>).then === "function")
        return (r as Promise<unknown>).then(
          (v) => v !== "error" && v !== "timed out",
          () => false,
        );
      return r !== "error" && r !== "timed out";
    } catch {
      return false;
    }
  };

  const sendUpdate = (event: "yjs-update" | "sync-reply", update: Uint8Array, extra: object = {}) => {
    const b64 = toBase64(update);
    if (b64.length <= maxPayload) return raw(event, { u: b64, ...extra });
    const id = `${sessionId}-${seq++}`;
    const n = Math.ceil(update.length / chunkRaw);
    const results: (boolean | Promise<boolean>)[] = [];
    for (let i = 0; i < n; i++)
      results.push(raw("yjs-chunk", { id, i, n, e: event, u: toBase64(update.subarray(i * chunkRaw, (i + 1) * chunkRaw)), ...(i === n - 1 ? extra : {}) }));
    return Promise.all(results).then((r) => r.every(Boolean));
  };

  const queue = (u: Uint8Array) => {
    pending = pending ? Y.mergeUpdates([pending, u]) : u;
  };

  const sendLocal = (u: Uint8Array) => {
    const r = sendUpdate("yjs-update", u);
    if (r === true) return;
    if (r === false) return queue(u);
    queue(u);
    const sent = u;
    (r as Promise<boolean>).then((ok) => {
      if (ok && pending === sent) pending = null;
    });
  };

  const flush = () => {
    if (!pending) return;
    const u = pending;
    pending = null;
    sendLocal(u);
  };

  const onDocUpdate = (u: Uint8Array, o: unknown) => {
    if (o === origin || destroyed) return;
    if (!subscribed) queue(u);
    else sendLocal(u);
  };
  doc.on("update", onDocUpdate);

  let awTimer: ReturnType<typeof setTimeout> | undefined;
  let awLast = -Infinity;
  const awChanged = new Set<number>();
  const sendAwareness = () => {
    awTimer = undefined;
    if (!awChanged.size) return;
    const ids = [...awChanged];
    awChanged.clear();
    awLast = Date.now();
    if (subscribed) raw("awareness", { u: toBase64(encodeAwarenessUpdate(awareness, ids)) });
  };
  const onAwareness = ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, o: unknown) => {
    if (o === origin || destroyed) return;
    for (const id of [...added, ...updated, ...removed]) if (id === doc.clientID) awChanged.add(id);
    if (!awChanged.size || awTimer) return;
    const wait = awLast + awIntervalMs - Date.now();
    if (wait <= 0) sendAwareness();
    else awTimer = setTimeout(sendAwareness, wait);
  };
  awareness.on("update", onAwareness);

  const apply = (u: Uint8Array) => Y.applyUpdate(doc, u, origin);

  const markSynced = () => {
    clearTimeout(syncTimer);
    if (subscribed) setStatus("synced");
  };

  const handlers: Record<string, (p: any) => void> = {
    "yjs-update": (p) => apply(fromBase64(p.u)),
    "sync-reply": (p) => {
      apply(fromBase64(p.u));
      const diff = Y.encodeStateAsUpdate(doc, fromBase64(p.sv));
      if (!emptyUpdate(diff) && subscribed) sendUpdate("yjs-update", diff);
      markSynced();
    },
    "sync-request": (p) => {
      if (!subscribed) return;
      sendUpdate("sync-reply", Y.encodeStateAsUpdate(doc, fromBase64(p.sv)), { sv: toBase64(Y.encodeStateVector(doc)) });
      if (awareness.getLocalState() !== null) raw("awareness", { u: toBase64(encodeAwarenessUpdate(awareness, [doc.clientID])) });
    },
    awareness: (p) => applyAwarenessUpdate(awareness, fromBase64(p.u), origin),
  };

  const dispatch = (event: string, p: any) => {
    if (destroyed || !p) return;
    try {
      handlers[event]?.(p);
    } catch {
      /* malformed payload */
    }
  };
  for (const ev of Object.keys(handlers)) channel.on(ev, (p) => dispatch(ev, p));
  channel.on("yjs-chunk", (p) => {
    if (!p || done.has(p.id)) return;
    let entry = chunks.get(p.id);
    if (!entry) chunks.set(p.id, (entry = { parts: new Array(p.n), got: 0 }));
    if (entry.parts[p.i]) return;
    entry.parts[p.i] = fromBase64(p.u);
    entry.got++;
    if (p.sv !== undefined) (entry as any).tail = p;
    if (entry.got < p.n) return;
    chunks.delete(p.id);
    done.add(p.id);
    const total = entry.parts as Uint8Array[];
    const buf = new Uint8Array(total.reduce((s, c) => s + c.length, 0));
    let off = 0;
    for (const c of total) (buf.set(c, off), (off += c.length));
    const tail = (entry as any).tail ?? {};
    dispatch(p.e, { ...tail, u: toBase64(buf) });
  });

  const requestSync = () => {
    raw("sync-request", { sv: toBase64(Y.encodeStateVector(doc)) });
    if (awareness.getLocalState() !== null) raw("awareness", { u: toBase64(encodeAwarenessUpdate(awareness, [doc.clientID])) });
    clearTimeout(syncTimer);
    syncTimer = setTimeout(markSynced, syncTimeoutMs);
  };

  channel.subscribe((s: ChannelStatus) => {
    if (destroyed) return;
    if (s === "SUBSCRIBED") {
      subscribed = true;
      setStatus("connecting");
      flush();
      requestSync();
    } else {
      subscribed = false;
      clearTimeout(syncTimer);
      const others = [...awareness.getStates().keys()].filter((id) => id !== doc.clientID);
      if (others.length) removeAwarenessStates(awareness, others, origin);
      setStatus("offline");
    }
  });

  return {
    get status() {
      return status;
    },
    get pendingBytes() {
      return pending?.length ?? 0;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearTimeout(syncTimer);
      clearTimeout(awTimer);
      doc.off("update", onDocUpdate);
      awareness.off("update", onAwareness);
      channel.unsubscribe();
    },
  };
}
