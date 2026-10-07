import test from 'node:test';
import assert from 'node:assert/strict';
import { RATIONALIZATIONS, scanRationalizations } from '../public/gates.mjs';

const scan = text => scanRationalizations({ title: '', summary: '', claims: [{ text }] });
const has = (text, id) => scan(text).some(r => r.id === id);

test('every rationalization pattern detects its canonical excuse', () => {
  const cases = [
    ['tests-later', "I'll add tests later."],
    ['tests-later', 'Write the tests afterwards, ship the feature first.'],
    ['unverified-confidence', 'It probably works.'],
    ['unverified-confidence', 'This should be fine.'],
    ['unverified-confidence', 'Seems right to me.'],
    ['too-small', 'This is too small to need a spec.'],
    ['too-small', 'Just a trivial change.'],
    ['flaky-failures', 'Those failures are flaky.'],
    ['flaky-failures', 'The 3 failing tests are pre-existing and unrelated.'],
    ['manual-check', 'I clicked through the flow once.'],
    ['manual-check', 'Works on my machine.'],
    ['review-later', "The scan findings are low-risk — I'll triage them after merge."],
    ['review-later', 'We can clean up the duplication later.'],
    ['deadline-pressure', 'Ship it now, clean up after.'],
    ['deadline-pressure', 'No time for a full review — deadline is tomorrow.'],
  ];
  for (const [id, text] of cases) assert.ok(has(text, id), `${id} should catch: "${text}"`);
});

test('clean evidence-referencing claims trigger no findings', () => {
  const clean = [
    'Tests: 14 pass / 0 fail — npm test output is in the report.',
    'Verified in-browser: invalid codes are rejected, a valid code updates the total.',
    'The diff is one concern, 184 insertions.',
    'Rollback is the DISCOUNT_V2 flag; revert commit if needed.',
    'Security scan clean; findings list is empty.',
    'Reviewed the diff myself before submitting.',
  ];
  for (const text of clean) {
    assert.deepEqual(scan(text), [], `false positive on: "${text}"`);
  }
});

test('each detected excuse carries a rebuttal and its target gate', () => {
  for (const r of RATIONALIZATIONS) {
    assert.ok(r.gate, r.id);
    assert.ok(r.rebuttal.length > 20, r.id);
    assert.ok(['define', 'plan', 'build', 'verify', 'review', 'ship'].includes(r.gate), r.id);
  }
  const found = scan("Probably works, I'll add tests later.");
  assert.equal(found.length, 2);
  assert.ok(found.every(f => f.quote.length > 0), 'the matched quote is reported');
});

test('summary text is scanned, not just claims', () => {
  const found = scanRationalizations({ title: 't', summary: 'Seems fine, ship it now.', claims: [] });
  assert.ok(found.some(r => r.id === 'unverified-confidence'));
  assert.ok(found.some(r => r.id === 'deadline-pressure'));
});
