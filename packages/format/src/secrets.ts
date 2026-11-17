export type SecretKind = "api_key" | "password" | "token" | "private_key" | "url_password";

export interface SecretMatch {
  start: number;
  end: number;
  kind: SecretKind;
}

export const secretLabel: Record<SecretKind, string> = {
  api_key: "an API key",
  password: "a password",
  token: "a token",
  private_key: "a private key",
  url_password: "a password in a link",
};

const KEY_SHAPES =
  /(?<![A-Za-z0-9_-])(sk-ant-[A-Za-z0-9_-]{8,}|sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|ghs_[A-Za-z0-9]{20,}|ghu_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[bp]-[A-Za-z0-9-]{10,}|AKIA[A-Z0-9]{16}|AIza[A-Za-z0-9_-]{30,})(?![A-Za-z0-9_-])/gd;
const PASSWORD_VALUE = /\bpassword\s*(?:[:=]|is:)\s*([^\s,;]{6,})/gid;
const PRIVATE_KEY = /-----BEGIN [A-Z ]*PRIVATE KEY-----(?:[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----|[\s\S]*$)/gd;
const SECRET_NEAR_WORD =
  /\b(?:api[ _-]?key|access[ _-]?key|secret(?:[ _-]?key)?|token)\b\W{0,3}(?:is|=|:)?\W{0,3}([A-Za-z0-9_\-/+=]{20,})/gid;
const BEARER = /\bbearer\s+([A-Za-z0-9._~+/=-]{16,})/gid;
const URL_PASSWORD = /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:([^\s/@]{3,})@/gid;
const PLACEHOLDER = /^(\{\{.*\}\}|<.*>|\[.*\]|\$\{.*\}|\$[A-Za-z_]+|\*{3,}|x{4,}|•+)$/i;

function looksRandom(v: string): boolean {
  return /\d/.test(v) && /[A-Za-z]/.test(v);
}

function scan(text: string, re: RegExp, kind: SecretKind, group: number, out: SecretMatch[], keep: (v: string) => boolean = () => true) {
  for (const m of text.matchAll(re)) {
    const value = m[group];
    const span = m.indices?.[group];
    if (!value || !span || !keep(value)) continue;
    out.push({ start: span[0], end: span[1], kind });
  }
}

export function findSecrets(text: string): SecretMatch[] {
  const found: SecretMatch[] = [];
  scan(text, KEY_SHAPES, "api_key", 1, found);
  scan(text, PRIVATE_KEY, "private_key", 0, found);
  scan(text, PASSWORD_VALUE, "password", 1, found, (v) => !PLACEHOLDER.test(v));
  scan(text, SECRET_NEAR_WORD, "token", 1, found, (v) => looksRandom(v) && !PLACEHOLDER.test(v));
  scan(text, BEARER, "token", 1, found, (v) => !PLACEHOLDER.test(v));
  scan(text, URL_PASSWORD, "url_password", 1, found, (v) => !PLACEHOLDER.test(v));
  found.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: SecretMatch[] = [];
  for (const m of found) {
    const last = merged[merged.length - 1];
    if (last && m.start < last.end) {
      if (m.end > last.end) last.end = m.end;
    } else merged.push({ ...m });
  }
  return merged;
}

export const REDACTED = "[redacted]";

export function redact(text: string): string {
  const found = findSecrets(text);
  if (!found.length) return text;
  let out = "";
  let at = 0;
  for (const m of found) {
    out += text.slice(at, m.start) + REDACTED;
    at = m.end;
  }
  return out + text.slice(at);
}
