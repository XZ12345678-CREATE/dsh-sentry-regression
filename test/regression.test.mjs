import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runRegression, compareRegression } from '../scripts/regression-run.mjs';

function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), 'dsh-regression-'));
  writeFileSync(join(cwd, 'test.cjs'), "const assert = require('node:assert/strict'); assert.equal(require('./value.cjs'), 2, 'regression-123');\n");
  writeFileSync(join(cwd, 'value.cjs'), 'module.exports = 1;\n');
  return { cwd, options: { cwd, issue: 'APP-123', testFiles: ['test.cjs'], command: [process.execPath, 'test.cjs'] }, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

test('real failing test then source-only fix produces a matching failure-to-pass record', () => {
  const f = fixture();
  try {
    const before = runRegression({ ...f.options, phase: 'before', expectedFailure: 'regression-123' });
    assert.equal(before.result, 'failed');
    assert.equal(before.expectedFailureMatched, true);
    writeFileSync(join(f.cwd, 'value.cjs'), 'module.exports = 2;\n');
    const after = runRegression({ ...f.options, phase: 'after' });
    assert.equal(after.result, 'passed');
    assert.equal(compareRegression(before, after).verdict, 'failure-to-pass-observed');
    assert.equal(compareRegression(before, { ...after, issue: 'APP-other' }).ok, false);
  } finally { f.cleanup(); }
});

test('weakened tests, absent failure marker and a missing executable cannot claim success', () => {
  const f = fixture();
  try {
    const before = runRegression({ ...f.options, phase: 'before', expectedFailure: 'unseen marker' });
    writeFileSync(join(f.cwd, 'test.cjs'), 'process.exit(0);\n');
    const after = runRegression({ ...f.options, phase: 'after' });
    assert.equal(compareRegression(before, after).ok, false);
    const missing = runRegression({ ...f.options, command: ['dsh-intentionally-nonexistent-executable'], phase: 'before', expectedFailure: 'x' });
    assert.equal(missing.result, 'infrastructure-error');
    assert.equal(compareRegression(missing, after).ok, false);
    assert.equal(compareRegression({ tests: [null] }, {}).ok, false);
  } finally { f.cleanup(); }
});

test('timeouts are distinct from regression failures and secret-looking output is redacted', () => {
  const f = fixture();
  try {
    const timed = runRegression({ ...f.options, command: [process.execPath, '-e', 'setInterval(()=>{},1000)'], phase: 'after', timeoutMs: 50 });
    assert.equal(timed.result, 'timed-out');
    const syntheticToken = ['gh', 'p_', 'A'.repeat(36)].join('');
    const secret = runRegression({ ...f.options, command: [process.execPath, '-e', `console.log('${syntheticToken}')`], phase: 'after' });
    assert.equal(secret.stdoutTail.includes('ghp_'), false);
    assert.equal(secret.command.join(' ').includes('ghp_'), false);
  } finally { f.cleanup(); }
});

test('test file symlinks outside the requested project are rejected', () => {
  const f = fixture();
  const outside = mkdtempSync(join(tmpdir(), 'dsh-outside-'));
  try {
    writeFileSync(join(outside, 'test.cjs'), '');
    symlinkSync(join(outside, 'test.cjs'), join(f.cwd, 'outside-test.cjs'));
    assert.throws(() => runRegression({ ...f.options, testFiles: ['outside-test.cjs'], phase: 'after' }), /inside cwd/);
  } finally { f.cleanup(); rmSync(outside, { recursive: true, force: true }); }
});
