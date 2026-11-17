const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = DIGITS.length;

function midpoint(a: string, b: string | null): string {
  if (b !== null && a >= b) throw new Error(`${a} >= ${b}`);
  if (a.endsWith("0") || (b !== null && b.endsWith("0"))) throw new Error("trailing zero");
  if (b !== null) {
    let n = 0;
    while ((a[n] ?? "0") === b[n]) n++;
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
  }
  const da = a ? DIGITS.indexOf(a[0]!) : 0;
  const db = b !== null ? DIGITS.indexOf(b[0]!) : BASE;
  if (db - da > 1) return DIGITS[Math.round((da + db) / 2)]!;
  if (b !== null && b.length > 1) return b.slice(0, 1);
  return DIGITS[da]! + midpoint(a.slice(1), null);
}

export function isValidKey(key: string): boolean {
  return key.length > 0 && !key.endsWith("0") && [...key].every((c) => DIGITS.includes(c));
}

export function generateKeyBetween(a: string | null, b: string | null): string {
  if (a !== null && !isValidKey(a)) throw new Error(`invalid index key: ${a}`);
  if (b !== null && !isValidKey(b)) throw new Error(`invalid index key: ${b}`);
  if (a !== null && b !== null && a >= b) throw new Error(`${a} must sort before ${b}`);
  return midpoint(a ?? "", b);
}

export function generateNKeysBetween(a: string | null, b: string | null, n: number): string[] {
  if (n <= 0) return [];
  if (n === 1) return [generateKeyBetween(a, b)];
  if (b === null) {
    const out: string[] = [];
    let c = generateKeyBetween(a, b);
    out.push(c);
    for (let i = 1; i < n; i++) out.push((c = generateKeyBetween(c, b)));
    return out;
  }
  if (a === null) {
    const out: string[] = [];
    let c = generateKeyBetween(a, b);
    out.push(c);
    for (let i = 1; i < n; i++) out.push((c = generateKeyBetween(a, c)));
    return out.reverse();
  }
  const mid = Math.floor(n / 2);
  const c = generateKeyBetween(a, b);
  return [...generateNKeysBetween(a, c, mid), c, ...generateNKeysBetween(c, b, n - mid - 1)];
}

export function compareKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
