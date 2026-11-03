import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const isMain = (url) => Boolean(process.argv[1] && url === pathToFileURL(resolve(process.argv[1])).href);
export function readJSON(path) {
  if (statSync(path).size > 10 * 1024 * 1024) throw new Error('JSON input exceeds 10 MiB.');
  return JSON.parse(readFileSync(path, 'utf8'));
}
export function writeJSON(path, value) {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
}
export function redact(text) {
  return String(text)
    .replace(/(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]+/g, '[REDACTED_TOKEN]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/\b(password|passwd|api[_-]?key|access[_-]?token|refresh[_-]?token|secret)\s*[:=]\s*["']?[^\s"',;]+/gi, '$1=[REDACTED]')
    .replace(/https?:\/\/[^\s/@]+:[^\s/@]+@/gi, 'https://[REDACTED]@');
}
export function printError(error) {
  process.stderr.write(`${redact(error.message)}\n`);
  process.exitCode = 1;
}
