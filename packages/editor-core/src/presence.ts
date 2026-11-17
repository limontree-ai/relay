import type { Awareness } from "y-protocols/awareness";

export interface PresencePayload {
  user_id: string;
  name: string;
  avatar: string | null;
  workflow_id: string;
  step_id: string | null;
  field: string | null;
}

export interface PresenceUser extends PresencePayload {
  client_id: number;
  color: string;
  self: boolean;
}

export const PALETTE = ["#e5484d", "#f76b15", "#ffb224", "#30a46c", "#12a594", "#0091ff", "#6e56cf", "#d6409f", "#8e4ec6", "#978365", "#00a2c7", "#5b6cff"];

export function colorFor(userId: string): string {
  let h = 2166136261;
  for (let i = 0; i < userId.length; i++) h = Math.imul(h ^ userId.charCodeAt(i), 16777619);
  return PALETTE[(h >>> 0) % PALETTE.length]!;
}

export function setLocalPresence(awareness: Awareness, p: PresencePayload) {
  awareness.setLocalState({ ...p, color: colorFor(p.user_id) });
}

export function updateLocalPresence(awareness: Awareness, patch: Partial<Pick<PresencePayload, "step_id" | "field">>) {
  const s = awareness.getLocalState();
  if (s) awareness.setLocalState({ ...s, ...patch });
}

export function readPresence(awareness: Awareness): PresenceUser[] {
  const out: PresenceUser[] = [];
  awareness.getStates().forEach((s, client_id) => {
    if (!s || typeof s.user_id !== "string") return;
    out.push({
      user_id: s.user_id,
      name: s.name ?? "",
      avatar: s.avatar ?? null,
      workflow_id: s.workflow_id ?? "",
      step_id: s.step_id ?? null,
      field: s.field ?? null,
      client_id,
      color: s.color ?? colorFor(s.user_id),
      self: client_id === awareness.clientID,
    });
  });
  return out.sort((a, b) => a.client_id - b.client_id);
}

function group(users: PresenceUser[], key: (u: PresenceUser) => string | null, includeSelf: boolean) {
  const m = new Map<string, PresenceUser[]>();
  const seen = new Set<string>();
  for (const u of users) {
    const k = key(u);
    if (k === null || (u.self && !includeSelf)) continue;
    const dedupe = `${k}|${u.user_id}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    (m.get(k) ?? m.set(k, []).get(k)!).push(u);
  }
  return m;
}

export const fieldKey = (stepId: string, field: string) => `${stepId}/${field}`;

export function whoInSteps(users: PresenceUser[], includeSelf = false) {
  return group(users, (u) => u.step_id, includeSelf);
}

/** keys are fieldKey(stepId, field) */
export function whoTypingInFields(users: PresenceUser[], includeSelf = false) {
  return group(users, (u) => (u.step_id !== null && u.field ? fieldKey(u.step_id, u.field) : null), includeSelf);
}

export function distinctUsers(users: PresenceUser[]) {
  const m = new Map<string, PresenceUser>();
  for (const u of users) if (!m.has(u.user_id)) m.set(u.user_id, u);
  return [...m.values()];
}
