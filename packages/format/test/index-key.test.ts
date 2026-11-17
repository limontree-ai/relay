import { describe, expect, it } from "vitest";
import { generateKeyBetween, generateNKeysBetween, isValidKey } from "../src";

const sorted = (a: string[]) => [...a].sort();

describe("generateKeyBetween", () => {
  it("makes a first key", () => {
    const k = generateKeyBetween(null, null);
    expect(isValidKey(k)).toBe(true);
  });
  it("goes after and before", () => {
    const a = generateKeyBetween(null, null);
    expect(generateKeyBetween(a, null) > a).toBe(true);
    expect(generateKeyBetween(null, a) < a).toBe(true);
  });
  it("goes between, strictly", () => {
    const pairs: [string | null, string | null][] = [["V", "W"], ["V", "V1"], ["Vz", "W"], ["1", "2"], ["a", "b"], ["V", "Vl"], ["z", null], [null, "1"]];
    for (const [a, b] of pairs) {
      const k = generateKeyBetween(a, b);
      if (a) expect(k > a).toBe(true);
      if (b) expect(k < b).toBe(true);
      expect(isValidKey(k)).toBe(true);
    }
  });
  it("never ends in 0 and rejects bad input", () => {
    expect(() => generateKeyBetween("b", "a")).toThrow();
    expect(() => generateKeyBetween("a", "a")).toThrow();
    expect(() => generateKeyBetween("a0", null)).toThrow();
    expect(() => generateKeyBetween("a-", null)).toThrow();
  });
  it("many inserts at the end stay ordered", () => {
    let prev: string | null = null;
    const keys: string[] = [];
    for (let i = 0; i < 500; i++) keys.push((prev = generateKeyBetween(prev, null)));
    expect(sorted(keys)).toEqual(keys);
    expect(new Set(keys).size).toBe(500);
  });
  it("many inserts at the start stay ordered", () => {
    let next: string | null = null;
    const keys: string[] = [];
    for (let i = 0; i < 500; i++) keys.unshift((next = generateKeyBetween(null, next)));
    expect(sorted(keys)).toEqual(keys);
    expect(new Set(keys).size).toBe(500);
  });
  it("many inserts in the same gap stay ordered", () => {
    const lo = generateKeyBetween(null, null);
    let top = generateKeyBetween(lo, null);
    const keys: string[] = [];
    for (let i = 0; i < 300; i++) {
      const k = generateKeyBetween(lo, top);
      expect(k > lo && k < top && isValidKey(k)).toBe(true);
      keys.push((top = k));
    }
    expect(new Set(keys).size).toBe(300);
  });
  it("random inserts keep a consistent order", () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const list: string[] = [];
    for (let i = 0; i < 1000; i++) {
      const at = Math.floor(rnd() * (list.length + 1));
      list.splice(at, 0, generateKeyBetween(list[at - 1] ?? null, list[at] ?? null));
    }
    expect(sorted(list)).toEqual(list);
    expect(new Set(list).size).toBe(1000);
  });
});

describe("generateNKeysBetween", () => {
  it("makes n ordered keys in each case", () => {
    for (const [a, b] of [[null, null], ["V", null], [null, "V"], ["V", "W"]] as const) {
      const ks = generateNKeysBetween(a, b, 30);
      expect(ks).toHaveLength(30);
      expect(sorted(ks)).toEqual(ks);
      expect(new Set(ks).size).toBe(30);
      if (a) expect(ks[0]! > a).toBe(true);
      if (b) expect(ks[29]! < b).toBe(true);
    }
    expect(generateNKeysBetween(null, null, 0)).toEqual([]);
  });
});
