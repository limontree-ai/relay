export type ChannelStatus = "SUBSCRIBED" | "CLOSED" | "CHANNEL_ERROR" | "TIMED_OUT";

/**
 * Mimics a Supabase Realtime broadcast channel with self:false.
 * send may return a promise or a status string; "error" and "timed out" and rejections count as failures.
 * on registers a handler for a broadcast event; the handler gets the payload only.
 * subscribe reports status changes, including later reconnects.
 */
export interface BroadcastChannelLike {
  send(event: string, payload: unknown): unknown;
  on(event: string, cb: (payload: any) => void): void;
  subscribe(cb: (status: ChannelStatus) => void): void;
  unsubscribe(): void;
}
