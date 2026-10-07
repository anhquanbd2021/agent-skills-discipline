import test from 'node:test';
import assert from 'node:assert/strict';
import { GATES, evaluateBundle, fmtResult } from '../public/gates.mjs';
import { BUNDLES } from '../public/bundles.mjs';

const result = (run, id) => run.results.find(r => r.gate === id);

// A minimal bundle that satisfies every gate — tests mutate one field at a
// time and assert exactly one gate breaks.
function cleanBundle() {
  return JSON.parse(JSON.stringify(BUNDLES.disciplined));
}

test('six gates run in lifecycle order', () => {
  assert.deepEqual(GATES.map(g => g.id), ['define', 'plan', 'build', 'verify', 'review', 'ship']);
});

test('disciplined bundle passes all six gates', () => {
  const run = evaluateBundle(BUNDLES.disciplined);
  assert.equal(run.verdict, 'pass');
  assert.equal(run.blockedAt, null);
  for (const r of run.results) assert.equal(r.status, 'pass', r.gate);
});

test('sloppy bundle is blocked at verify — no test report, no runtime check, excuses flagged', () => {
  const run = evaluateBundle(BUNDLES.sloppy);
  assert.equal(run.verdict, 'blocked');
  assert.equal(run.blockedAt, 'verify');
  const v = result(run, 'verify');
  assert.equal(v.status, 'fail');
  assert.ok(v.missing.some(m => m.includes('testReport')), 'test report missing');
  assert.ok(v.missing.some(m => m.includes('runtimeCheck')), 'runtime check missing for UI file');
  assert.ok(v.rationalizations.length >= 3, 'excuses attach to the verify gate');
  // Blocking is ordered: later gates never ran.
  assert.equal(result(run, 'review').status, 'skipped');
  assert.equal(result(run, 'ship').status, 'skipped');
});

test('rationalized bundle has every slot filled but is blocked at review', () => {
  const run = evaluateBundle(BUNDLES.rationalized);
  assert.equal(run.verdict, 'blocked');
  assert.equal(run.blockedAt, 'review');
  const r = result(run, 'review');
  assert.ok(r.missing.some(m => m.includes('not triaged')), 'untriaged findings reported');
  assert.ok(r.missing.some(m => m.includes('selfReview')), 'empty self-review reported');
  assert.equal(r.rationalizations[0].id, 'review-later');
  assert.equal(result(run, 'verify').status, 'pass', 'verify evidence itself was adequate');
  assert.equal(result(run, 'ship').status, 'skipped');
});

test('a spec with a title but no acceptance criteria fails define', () => {
  const b = cleanBundle();
  b.evidence.spec = { objectives: ['make it better'] };
  const run = evaluateBundle(b);
  assert.equal(run.blockedAt, 'define');
  assert.ok(result(run, 'define').missing.some(m => m.includes('acceptanceCriteria')));
});

test('a plan task without its own verify step fails plan', () => {
  const b = cleanBundle();
  b.evidence.plan.tasks = [{ title: 'do all of it' }];
  const run = evaluateBundle(b);
  assert.equal(run.blockedAt, 'plan');
});

test('an oversized diff fails build even with perfect paperwork', () => {
  const b = cleanBundle();
  b.diff = { files: ['a.js'], insertions: 900, deletions: 0 };
  const run = evaluateBundle(b);
  assert.equal(run.blockedAt, 'build');
});

test('a test report with failures fails verify — passing counts are not enough', () => {
  const b = cleanBundle();
  b.evidence.testReport = { command: 'npm test', passed: 118, failed: 3 };
  const run = evaluateBundle(b);
  assert.equal(run.blockedAt, 'verify');
  assert.ok(result(run, 'verify').missing.some(m => m.includes('failed')));
});

test('a boolean-shaped test report fails verify — counts must be real numbers', () => {
  const b = cleanBundle();
  b.evidence.testReport = { command: 'npm test', passed: true, failed: false };
  const run = evaluateBundle(b);
  assert.equal(run.blockedAt, 'verify');
});

test('UI diffs require runtime evidence; server-only diffs do not', () => {
  const b = cleanBundle();
  delete b.evidence.runtimeCheck;
  b.diff.files = ['src/api.js', 'src/db.js'];
  assert.equal(result(evaluateBundle(b), 'verify').status, 'pass');
  b.diff.files = ['src/api.js', 'src/page.html'];
  const run = evaluateBundle(b);
  assert.equal(run.blockedAt, 'verify');
  assert.ok(result(run, 'verify').missing.some(m => m.includes('runtimeCheck')));
});

test('no rollback plan fails ship — the last gate still bites', () => {
  const b = cleanBundle();
  delete b.evidence.release.rollback;
  const run = evaluateBundle(b);
  assert.equal(run.blockedAt, 'ship');
  for (const id of ['define', 'plan', 'build', 'verify', 'review']) {
    assert.equal(result(run, id).status, 'pass', id);
  }
});

test('fmtResult renders every status', () => {
  const run = evaluateBundle(BUNDLES.sloppy);
  const lines = run.results.map(fmtResult);
  assert.ok(lines.some(l => l.includes('PASS')));
  assert.ok(lines.some(l => l.includes('FAIL')));
  assert.ok(lines.some(l => l.includes('SKIPPED')));
});
