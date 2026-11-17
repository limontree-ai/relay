import type { BroadcastChannelLike, ChannelStatus } from "./channel";

export interface MemoryHubOptions {
  latency?: number | (() => number);
  dropRate?: number;
  duplicateRate?: number;
  random?: () => number;
}

export class MemoryHub {
  latency: number | (() => number);
  dropRate: number;
  duplicateRate: number;
  random: () => number;
  inflight = 0;
  sent: { from: MemoryChannel; event: string; payload: unknown }[] = [];
  readonly channels = new Set<MemoryChannel>();
  private waiters: (() => void)[] = [];

  constructor(o: MemoryHubOptions = {}) {
    this.latency = o.latency ?? 0;
    this.dropRate = o.dropRate ?? 0;
    this.duplicateRate = o.duplicateRate ?? 0;
    this.random = o.random ?? Math.random;
  }

  createChannel() {
    const c = new MemoryChannel(this);
    this.channels.add(c);
    return c;
  }

  /** @internal */
  route(from: MemoryChannel, event: string, payload: unknown) {
    this.sent.push({ from, event, payload });
    for (const to of this.channels) {
      if (to === from || !to.subscribed) continue;
      if (this.random() < this.dropRate) continue;
      const copies = this.random() < this.duplicateRate ? 2 : 1;
      for (let i = 0; i < copies; i++) this.deliver(to, event, payload);
    }
  }

  private deliver(to: MemoryChannel, event: string, payload: unknown) {
    const ms = typeof this.latency === "function" ? this.latency() : this.latency;
    const copy = structuredClone(payload);
    if (ms <= 0) return to.receive(event, copy);
    this.inflight++;
    setTimeout(() => {
      to.receive(event, copy);
      if (--this.inflight === 0) this.waiters.splice(0).forEach((w) => w());
    }, ms);
  }

  settle(): Promise<void> {
    return this.inflight === 0 ? Promise.resolve() : new Promise((r) => this.waiters.push(r));
  }

  count(event: string) {
    return this.sent.filter((s) => s.event === event).length;
  }
}

export class MemoryChannel implements BroadcastChannelLike {
  subscribed = false;
  connected = true;
  private handlers = new Map<string, ((p: any) => void)[]>();
  private statusCb?: (s: ChannelStatus) => void;

  constructor(private hub: MemoryHub) {}

  send(event: string, payload: unknown) {
    if (!this.subscribed) return "error";
    this.hub.route(this, event, payload);
    return "ok";
  }

  on(event: string, cb: (p: any) => void) {
    (this.handlers.get(event) ?? this.handlers.set(event, []).get(event)!).push(cb);
  }

  subscribe(cb: (s: ChannelStatus) => void) {
    this.statusCb = cb;
    if (!this.connected) return cb("CHANNEL_ERROR");
    this.subscribed = true;
    cb("SUBSCRIBED");
  }

  unsubscribe() {
    this.subscribed = false;
    this.hub.channels.delete(this);
  }

  /** @internal */
  receive(event: string, payload: unknown) {
    if (!this.subscribed) return;
    this.handlers.get(event)?.forEach((h) => h(payload));
  }

  disconnect() {
    this.connected = false;
    if (!this.subscribed) return;
    this.subscribed = false;
    this.statusCb?.("CLOSED");
  }

  reconnect() {
    this.connected = true;
    if (this.subscribed || !this.statusCb) return;
    this.subscribed = true;
    this.statusCb("SUBSCRIBED");
  }
}
