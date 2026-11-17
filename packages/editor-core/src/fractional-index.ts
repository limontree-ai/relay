export const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function midpoint(a: string, b: string | null): string {
  if (b !== null && a >= b) throw new Error(`${a} >= ${b}`);
  if (a.endsWith("0") || (b !== null && b.endsWith("0"))) throw new Error("trailing zero");
  if (b !== null) {
    let n = 0;
    while ((a[n] ?? "0") === b[n]) n++;
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
  }
  const da = a ? DIGITS.indexOf(a[0]!) : 0;
  const db = b !== null ? DIGITS.indexOf(b[0]!) : DIGITS.length;
  if (db - da > 1) return DIGITS[Math.round((da + db) / 2)]!;
  if (b !== null && b.length > 1) return b.slice(0, 1);
  return DIGITS[da]! + midpoint(a.slice(1), null);
}

function valid(k: string | null) {
  if (k === null) return;
  if (k === "" || k.endsWith("0") || [...k].some((c) => !DIGITS.includes(c))) throw new Error(`invalid key ${k}`);
}

export function generateKeyBetween(a: string | null, b: string | null): string {
  valid(a);
  valid(b);
  if (a !== null && b !== null && a >= b) throw new Error(`${a} >= ${b}`);
  return midpoint(a ?? "", b);
}

export function generateNKeysBetween(a: string | null, b: string | null, n: number): string[] {
  if (n <= 0) return [];
  if (n === 1) return [generateKeyBetween(a, b)];
  if (b === null) {
    const out: string[] = [];
    let c = a;
    for (let i = 0; i < n; i++) out.push((c = generateKeyBetween(c, null)));
    return out;
  }
  if (a === null) {
    const out: string[] = [];
    let c = b;
    for (let i = 0; i < n; i++) out.push((c = generateKeyBetween(null, c)));
    return out.reverse();
  }
  const mid = Math.floor(n / 2);
  const m = generateKeyBetween(a, b);
  return [...generateNKeysBetween(a, m, mid), m, ...generateNKeysBetween(m, b, n - mid - 1)];
}
