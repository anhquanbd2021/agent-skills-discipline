// CLI side-by-side report: run all three scripted agents' bundles through
// the six gates and print where each one lands.
import { evaluateBundle, fmtResult, GATES } from '../public/gates.mjs';
import { BUNDLES } from '../public/bundles.mjs';

const rule = '─'.repeat(72);

console.log('GATEKEEPER — six quality gates, three agents\n');
console.log(`Gate sequence: ${GATES.map(g => g.phase).join(' → ')}\n`);

for (const [id, bundle] of Object.entries(BUNDLES)) {
  const run = evaluateBundle(bundle);
  console.log(rule);
  console.log(`${id.toUpperCase()} — ${bundle.agent}`);
  console.log(`"${bundle.title}" — ${bundle.diff.files.length} files, +${bundle.diff.insertions}/-${bundle.diff.deletions}`);
  console.log(rule);
  for (const r of run.results) console.log('  ' + fmtResult(r));
  const ex = run.rationalizations;
  if (ex.length) {
    console.log('  Rationalizations detected:');
    for (const r of ex) console.log(`    • ${r.excuse}  (quote: "${r.quote}")`);
  }
  console.log(`  VERDICT: ${run.verdict === 'pass' ? 'PASS — cleared all six gates' : `BLOCKED at ${run.blockedAt.toUpperCase()}`}`);
  console.log('');
}
