import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";

import { colorFor, fieldKey, MemoryHub, PALETTE, readPresence, setLocalPresence, updateLocalPresence, whoInSteps, whoTypingInFields, distinctUsers } from "../src";
import { client } from "./helpers";

const p = (user_id: string, step_id: string | null = null, field: string | null = null) => ({ user_id, name: user_id.toUpperCase(), avatar: null, workflow_id: "w1", step_id, field });

describe("presence", () => {
  it("assigns stable colors from the palette", () => {
    expect(colorFor("u1")).toBe(colorFor("u1"));
    expect(PALETTE).toContain(colorFor("u2"));
    expect(new Set(["a", "b", "c", "d", "e", "f"].map(colorFor)).size).toBeGreaterThan(2);
  });

  it("computes who is in which step and who types where", () => {
    const hub = new MemoryHub();
    const o = { awarenessIntervalMs: 0 };
    const [a, b, c] = [client(hub, undefined, o), client(hub, undefined, o), client(hub, undefined, o)];
    setLocalPresence(a.awareness, p("a", "s-1", "action"));
    setLocalPresence(b.awareness, p("b", "s-1"));
    setLocalPresence(c.awareness, p("c", "s-2", "role"));
    const seen = readPresence(a.awareness);
    expect(seen).toHaveLength(3);
    expect(seen.find((u) => u.self)?.user_id).toBe("a");
    const steps = whoInSteps(seen);
    expect(steps.get("s-1")?.map((u) => u.user_id)).toEqual(["b"]);
    expect(whoInSteps(seen, true).get("s-1")?.map((u) => u.user_id).sort()).toEqual(["a", "b"]);
    const typing = whoTypingInFields(seen, true);
    expect(typing.get(fieldKey("s-1", "action"))?.map((u) => u.user_id)).toEqual(["a"]);
    expect(typing.get(fieldKey("s-2", "role"))?.[0]?.color).toBe(colorFor("c"));
    expect(typing.has(fieldKey("s-1", "role"))).toBe(false);
    updateLocalPresence(c.awareness, { step_id: "s-1", field: null });
    expect(whoInSteps(readPresence(a.awareness)).get("s-1")?.map((u) => u.user_id).sort()).toEqual(["b", "c"]);
  });

  it("dedupes one user in two tabs", () => {
    const aw1 = new Awareness(new Y.Doc());
    const aw2 = new Awareness(new Y.Doc());
    setLocalPresence(aw1, p("a", "s-1"));
    setLocalPresence(aw2, p("a", "s-1"));
    const users = [...readPresence(aw1), ...readPresence(aw2)];
    expect(whoInSteps(users, true).get("s-1")).toHaveLength(1);
    expect(distinctUsers(users)).toHaveLength(1);
  });

  it("drops remote presence when the client goes offline", () => {
    const hub = new MemoryHub();
    const a = client(hub);
    const b = client(hub);
    setLocalPresence(b.awareness, p("b", "s-1"));
    expect(readPresence(a.awareness).some((u) => u.user_id === "b")).toBe(true);
    a.channel.disconnect();
    expect(readPresence(a.awareness).some((u) => u.user_id === "b")).toBe(false);
  });
});
