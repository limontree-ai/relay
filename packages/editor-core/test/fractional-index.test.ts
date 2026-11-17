import { describe, expect, it } from "vitest";

import { generateKeyBetween, generateNKeysBetween } from "../src";
import { rng } from "./helpers";

describe("fractional index", () => {
  it("starts with a middle key", () => expect(generateKeyBetween(null, null)).toBe("V"));

  it("appends and prepends in order", () => {
    let k: string | null = null;
    const keys: string[] = [];
    for (let i = 0; i < 100; i++) keys.push((k = generateKeyBetween(k, null)));
    expect([...keys].sort()).toEqual(keys);
    let p: string | null = null;
    const pre: string[] = [];
    for (let i = 0; i < 100; i++) pre.push((p = generateKeyBetween(null, p)));
    expect([...pre].sort().reverse()).toEqual(pre);
  });

  it("random insertion keeps strict order and no trailing zeros", () => {
    const r = rng(7);
    let list: string[] = [generateKeyBetween(null, null)];
    for (let i = 0; i < 2000; i++) {
      const pos = Math.floor(r() * (list.length + 1));
      const k = generateKeyBetween(list[pos - 1] ?? null, list[pos] ?? null);
      expect(k.endsWith("0")).toBe(false);
      if (pos > 0) expect(k > list[pos - 1]!).toBe(true);
      if (pos < list.length) expect(k < list[pos]!).toBe(true);
      list.splice(pos, 0, k);
    }
    expect([...list].sort()).toEqual(list);
    expect(new Set(list).size).toBe(list.length);
  });

  it("repeated insertion at one spot stays short-ish", () => {
    let a = "V";
    const b = "W";
    for (let i = 0; i < 50; i++) a = generateKeyBetween(a, b);
    expect(a.length).toBeLessThan(60);
  });

  it("rejects bad input", () => {
    expect(() => generateKeyBetween("b", "a")).toThrow();
    expect(() => generateKeyBetween("a", "a")).toThrow();
    expect(() => generateKeyBetween("a0", null)).toThrow();
    expect(() => generateKeyBetween("a-", null)).toThrow();
  });

  it("generates n keys between", () => {
    for (const [a, b] of [[null, null], ["a", null], [null, "a"], ["a", "b"]] as const) {
      const ks = generateNKeysBetween(a, b, 9);
      expect(ks).toHaveLength(9);
      expect([...ks].sort()).toEqual(ks);
      if (a) expect(ks[0]! > a).toBe(true);
      if (b) expect(ks[8]! < b).toBe(true);
    }
  });
});
