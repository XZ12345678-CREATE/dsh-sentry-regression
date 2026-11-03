import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { isMain, printError, readJSON, redact, writeJSON } from '../lib/io.js';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const stableTests = (tests) => JSON.stringify(tests.map(({ path, sha256 }) => ({ path, sha256 })).sort((a, b) => a.path.localeCompare(b.path)));
function testIdentities(cwd, paths) {
  return [...new Set(paths)].map((path) => {
    const actual = realpathSync(resolve(cwd, path));
    const inside = relative(cwd, actual);
    if (inside === '..' || inside.startsWith('../') || inside.startsWith('..\\') || isAbsolute(inside)) throw new Error('Test files must stay inside cwd, including symlink targets.');
    return { path: inside, sha256: sha256(readFileSync(actual)) };
  }).sort((a, b) => a.path.localeCompare(b.path));
}

/** Runs only the supplied argv, inheriting the caller's execution permissions. */
export function runRegression({ cwd, command, issue, phase, testFiles, expectedFailure, timeoutMs = 120000 }) {
  const root = realpathSync(cwd);
  if (!Array.isArray(command) || !command.length || command.some((value) => typeof value !== 'string' || value.includes('\0'))) throw new Error('Provide an executable and argv after --.');
  if (!['before', 'after'].includes(phase) || typeof issue !== 'string' || !issue.trim()) throw new Error('An issue ID and before/after phase are required.');
  if (!Array.isArray(testFiles) || !testFiles.length) throw new Error('At least one --test-file is required.');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 300000) throw new Error('timeoutMs must be 1..300000.');
  if (phase === 'before' && (typeof expectedFailure !== 'string' || !expectedFailure.trim())) throw new Error('Before runs require a literal --expect-failure marker.');
  const testsBefore = testIdentities(root, testFiles);
  const run = spawnSync(command[0], command.slice(1), { cwd: root, encoding: 'utf8', shell: false, timeout: timeoutMs, killSignal: 'SIGKILL', maxBuffer: 256 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const stdout = run.stdout ?? '';
  const stderr = run.stderr ?? '';
  const testsAfter = testIdentities(root, testFiles);
  const result = run.error ? (run.error.code === 'ETIMEDOUT' ? 'timed-out' : 'infrastructure-error') : run.signal ? 'terminated' : run.status === 0 ? 'passed' : 'failed';
  return {
    schemaVersion: 1, kind: 'regression-receipt', issue: redact(issue), phase, cwd: root, ranAt: new Date().toISOString(),
    command: command.map(redact), commandDigest: sha256(JSON.stringify(command)), tests: testsBefore,
    testsStableDuringRun: stableTests(testsBefore) === stableTests(testsAfter),
    result, exitCode: run.status, signal: run.signal,
    expectedFailureMarker: expectedFailure ? redact(expectedFailure) : null,
    expectedFailureMatched: Boolean(expectedFailure && `${stdout}\n${stderr}`.includes(expectedFailure)),
    stdoutTail: redact(stdout).slice(-16000), stderrTail: redact(stderr).slice(-16000),
    outputDigest: sha256(`${stdout}\0${stderr}`),
    limits: 'Local process receipt; output tails are bounded and best-effort redacted. Does not authenticate the issue, prove causality, or supervise all descendant processes.',
  };
}

export function compareRegression(before, after) {
  const issues = [];
  const validTests = (tests) => Array.isArray(tests) && tests.length > 0 && tests.every((item) => item && typeof item.path === 'string' && item.path.length > 0 && /^[a-f0-9]{64}$/.test(item.sha256)) && new Set(tests.map((item) => item.path)).size === tests.length;
  for (const [label, receipt] of [['before', before], ['after', after]]) {
    if (receipt?.schemaVersion !== 1 || receipt.kind !== 'regression-receipt' || receipt.phase !== label) issues.push(`Invalid ${label} receipt.`);
    if (!validTests(receipt?.tests)) issues.push(`${label}: valid, unique test file hashes are required.`);
    if (receipt?.testsStableDuringRun !== true) issues.push(`${label}: test files changed during execution or stability was not recorded.`);
  }
  if (before?.result !== 'failed' || before?.expectedFailureMatched !== true) issues.push('Before must fail normally with the expected failure marker.');
  if (after?.result !== 'passed') issues.push('After must pass.');
  for (const key of ['issue', 'cwd', 'commandDigest']) if (!before?.[key] || before[key] !== after?.[key]) issues.push(`${key} differs or is missing.`);
  if (validTests(before?.tests) && validTests(after?.tests) && stableTests(before.tests) !== stableTests(after.tests)) issues.push('The test file set or contents changed between runs.');
  return { ok: issues.length === 0, verdict: issues.length ? 'incomplete-evidence' : 'failure-to-pass-observed', issues, limits: 'Local consistency only; review that the test targets the actual incident and that fixes did not weaken behavior.' };
}

if (isMain(import.meta.url)) {
  try {
    const [action, ...args] = process.argv.slice(2);
    if (action === 'compare') {
      const { positionals } = parseArgs({ args, allowPositionals: true, options: {} });
      if (positionals.length !== 2) throw new Error('Usage: regression-run.mjs compare before.json after.json');
      const result = compareRegression(readJSON(positionals[0]), readJSON(positionals[1]));
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.ok ? 0 : 1;
    } else if (action === 'run') {
      const separator = args.indexOf('--');
      if (separator < 0) throw new Error('Put the test executable and arguments after --.');
      const { values } = parseArgs({ args: args.slice(0, separator), options: { cwd: { type: 'string' }, issue: { type: 'string' }, phase: { type: 'string' }, out: { type: 'string' }, 'test-file': { type: 'string', multiple: true }, 'expect-failure': { type: 'string' }, 'timeout-ms': { type: 'string' } } });
      if (!values.cwd || !values.out) throw new Error('--cwd and a new --out path are required.');
      const result = runRegression({ cwd: values.cwd, issue: values.issue, phase: values.phase, command: args.slice(separator + 1), testFiles: values['test-file'], expectedFailure: values['expect-failure'], timeoutMs: values['timeout-ms'] ? Number(values['timeout-ms']) : undefined });
      writeJSON(values.out, result);
      console.log(JSON.stringify({ receipt: values.out, result: result.result, testsStableDuringRun: result.testsStableDuringRun, expectedFailureMatched: result.expectedFailureMatched }, null, 2));
      // Exit status describes the observed test; a saved failing receipt still exits nonzero.
      process.exitCode = result.result === 'passed' ? 0 : 1;
    } else throw new Error('Usage: regression-run.mjs run ... -- executable args | compare before.json after.json');
  } catch (error) { printError(error); }
}
