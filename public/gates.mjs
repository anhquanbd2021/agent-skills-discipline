// Gatekeeper — the quality-gate engine.
// Pure ES module shared by the browser UI, the CLI, and node:test.
//
// A "bundle" is everything an agent submits when it says a change is done:
//
//   {
//     title: string,                    // what the change is
//     summary: string,                  // the agent's own description
//     claims: [{ text }],               // things the agent *asserts*
//     diff: { files: [string], insertions, deletions },
//     evidence: { spec, plan, testReport, runtimeCheck,
//                 securityScan, selfReview, release }
//   }
//
// Six ordered gates mirror the Agent Skills lifecycle (define → plan →
// build → verify → review → ship). Each gate has an evidence contract —
// a checklist of fields that must exist AND be non-empty/correctly typed.
// A claim like "tests pass" is not evidence; a test report with the command
// that was run and the counts it printed is.
//
// The first failing gate BLOCKS the run: later gates are reported as
// 'skipped' because shipping is decided at the first broken promise —
// exactly like a pipeline that stops on a red stage.

// --- Rationalization scanner ------------------------------------------------
// Each pattern is one excuse agents reach for, mapped to the gate it tries
// to bypass, with the rebuttal a disciplined process gives. Detection is
// deliberately simple substring/regex matching — the lab's point is that
// these phrases should never *substitute* for evidence, not that we can
// perfectly parse natural language.

export const RATIONALIZATIONS = [
  {
    id: 'tests-later',
    gate: 'verify',
    pattern: /\b(add|write|do|fix)\b[^.]{0,30}\btests?\b[^.]{0,20}\blater\b|\btests?\b[^.]{0,25}\b(later|tomorrow|afterwards|after we ship)\b/i,
    excuse: '"I\'ll add tests later."',
    rebuttal: 'Tests written later test what was shipped, not what was intended. Red-before-green is the gate, not a suggestion.',
  },
  {
    id: 'unverified-confidence',
    gate: 'verify',
    pattern: /\bprobably (works?|fine|ok(ay)?|correct)\b|\bshould (work|be fine|be ok(ay)?)\b|\bseems? (to work|right|fine|correct|ok(ay)?)\b/i,
    excuse: '"It probably works."',
    rebuttal: 'Confidence is not evidence. Run the thing and paste the output — "seems right" is never a verification step.',
  },
  {
    id: 'too-small',
    gate: 'define',
    pattern: /\btoo (small|simple|trivial)\b[^.]{0,30}\b(need|for|require)\b|\btrivial change\b|\bjust a (small|tiny|quick)\b/i,
    excuse: '"Too small to need a spec."',
    rebuttal: 'Small changes are where undocumented assumptions hide best. A one-line spec still states intent a reviewer can check.',
  },
  {
    id: 'flaky-failures',
    gate: 'verify',
    pattern: /\bflaky\b|\bpre-?existing\b|\bunrelated\b[^.]{0,20}\b(failures?|tests?|broken)\b|\b(failures?|failing|fails?|tests?)\b[^.]{0,25}\b(unrelated|pre-?existing|flaky)\b|\bnot (caused|related) by\b/i,
    excuse: '"Those failures are flaky / pre-existing."',
    rebuttal: 'Uninvestigated red is still red. Prove it fails on a clean baseline, quarantine it with a ticket — or fix it.',
  },
  {
    id: 'manual-check',
    gate: 'verify',
    pattern: /\bclicked through\b|\bworks? on my machine\b|\btried it (once|myself)\b|\btested (it )?manually\b/i,
    excuse: '"I clicked through it once."',
    rebuttal: 'One manual pass is a data point, not a regression suite. Next week nobody can re-run your click-through.',
  },
  {
    id: 'review-later',
    gate: 'review',
    pattern: /\b(triage|review|audit|clean ?up)\b[^.]{0,25}\b(after (merge|ship|launch)|later)\b|\blow[- ]?risk\b[^.]{0,40}\b(after (merge|ship|launch)|ignore|skip|later|fine)\b/i,
    excuse: '"Findings are low-risk — triage after merge."',
    rebuttal: 'Untriaged findings are unknowns, not low-risk. The gate asks for a decision record, not a dismissal.',
  },
  {
    id: 'deadline-pressure',
    gate: 'ship',
    pattern: /\bship (it )?(now|first|fast|asap)\b|\bno time (for|to)\b|\bdeadline\b[^.]{0,30}\b(ship|merge|skip)\b|\bmerge (it )?now\b/i,
    excuse: '"Ship it now, clean up after."',
    rebuttal: 'Speed without a rollback plan is just risk arriving sooner. Faster is safer — but only when the gate stays up.',
  },
];

// Scan free text (title, summary, every claim) for rationalizations.
// Returns [{ id, gate, excuse, rebuttal, quote }] with the matched quote.
export function scanRationalizations(bundle) {
  const sources = [];
  if (typeof bundle.title === 'string') sources.push(bundle.title);
  if (typeof bundle.summary === 'string') sources.push(bundle.summary);
  for (const c of bundle.claims || []) {
    if (c && typeof c.text === 'string') sources.push(c.text);
  }
  const found = [];
  for (const text of sources) {
    for (const r of RATIONALIZATIONS) {
      const m = text.match(r.pattern);
      if (m) found.push({ id: r.id, gate: r.gate, excuse: r.excuse, rebuttal: r.rebuttal, quote: m[0] });
    }
  }
  return found;
}

// --- Evidence contracts ------------------------------------------------------

const isNonEmptyString = v => typeof v === 'string' && v.trim().length > 0;
const isNonEmptyArray = v => Array.isArray(v) && v.length > 0;
// Plain .js is ambiguous (server code too) — only unambiguous UI file types
// trigger the runtime-evidence requirement.
const looksLikeUiFile = f => /\.(html?|css|jsx|tsx|vue|svelte)$/i.test(f);

// Each gate: { id, phase, principle, requires(bundle) -> [missing...] }.
// `requires` returns a list of human-readable gaps; empty = gate satisfied
// on evidence. Rationalizations aimed at the gate are attached separately.

export const GATES = [
  {
    id: 'define',
    phase: 'DEFINE',
    principle: 'Spec before code',
    summary: 'A spec exists with objectives and acceptance criteria — intent a reviewer can check, not just a title.',
    requires(bundle) {
      const s = bundle.evidence?.spec;
      const missing = [];
      if (!s || typeof s !== 'object') return ['no spec submitted — a title is not a spec'];
      if (!isNonEmptyArray(s.objectives)) missing.push('spec.objectives — what this change is for');
      if (!isNonEmptyArray(s.acceptanceCriteria)) missing.push('spec.acceptanceCriteria — how we know it is done');
      return missing;
    },
  },
  {
    id: 'plan',
    phase: 'PLAN',
    principle: 'Small, atomic tasks',
    summary: 'The work is decomposed into tasks, each with its own way to verify it was done.',
    requires(bundle) {
      const p = bundle.evidence?.plan;
      const missing = [];
      if (!p || typeof p !== 'object') return ['no plan submitted — the change arrived as one undifferentiated blob'];
      if (!isNonEmptyArray(p.tasks)) return ['plan.tasks — the atomic steps'];
      p.tasks.forEach((t, i) => {
        if (!isNonEmptyString(t?.title)) missing.push(`plan.tasks[${i}].title`);
        if (!isNonEmptyString(t?.verify)) missing.push(`plan.tasks[${i}].verify — how this step gets checked`);
      });
      return missing;
    },
  },
  {
    id: 'build',
    phase: 'BUILD',
    principle: 'One slice at a time',
    summary: 'The diff stays reviewable: a bounded file count and a bounded size — thin vertical slices, not a big bang.',
    requires(bundle) {
      const d = bundle.diff;
      const missing = [];
      if (!d || typeof d !== 'object') return ['no diff submitted — nothing to review'];
      if (!isNonEmptyArray(d.files)) missing.push('diff.files — which files changed');
      const files = isNonEmptyArray(d.files) ? d.files.length : 0;
      if (files > 12) missing.push(`diff touches ${files} files — slice it (limit 12)`);
      if (typeof d.insertions !== 'number' || d.insertions < 0) {
        missing.push('diff.insertions — line count must be reported');
      } else if (d.insertions > 400) {
        missing.push(`diff.insertions = ${d.insertions} — too big to review honestly (limit 400)`);
      }
      return missing;
    },
  },
  {
    id: 'verify',
    phase: 'VERIFY',
    principle: 'Tests are proof',
    summary: 'A test report with the command and its counts — plus runtime evidence when the change touches the UI.',
    requires(bundle) {
      const e = bundle.evidence || {};
      const t = e.testReport;
      const missing = [];
      if (!t || typeof t !== 'object') {
        missing.push('evidence.testReport — the command that was run and what it printed');
      } else {
        if (!isNonEmptyString(t.command)) missing.push('testReport.command — what was actually run');
        if (typeof t.passed !== 'number' || !(t.passed > 0)) missing.push('testReport.passed — a real count of passing tests');
        if (t.failed !== 0) missing.push(`testReport.failed = ${typeof t.failed === 'number' ? t.failed : 'unreported'} — must be 0`);
      }
      const touchedUi = (bundle.diff?.files || []).some(looksLikeUiFile);
      if (touchedUi) {
        const rc = e.runtimeCheck;
        if (!rc || typeof rc !== 'object') {
          missing.push('evidence.runtimeCheck — UI files changed; show it rendered and behaved');
        } else {
          if (!isNonEmptyString(rc.tool)) missing.push('runtimeCheck.tool — what observed the runtime');
          if (!isNonEmptyArray(rc.observations)) missing.push('runtimeCheck.observations — what was seen');
        }
      }
      return missing;
    },
  },
  {
    id: 'review',
    phase: 'REVIEW',
    principle: 'Improve code health',
    summary: 'A security scan with triaged findings and a self-review checklist — review is a step, not a vibe.',
    requires(bundle) {
      const e = bundle.evidence || {};
      const missing = [];
      const sec = e.securityScan;
      if (!sec || typeof sec !== 'object') {
        missing.push('evidence.securityScan — what looked for secrets, injection, dependency risk');
      } else {
        if (!isNonEmptyString(sec.tool)) missing.push('securityScan.tool — what ran the check');
        if (!Array.isArray(sec.findings)) missing.push('securityScan.findings — even an empty list is evidence');
        if (Array.isArray(sec.findings) && sec.findings.length > 0 && sec.triaged !== true) {
          missing.push(`securityScan: ${sec.findings.length} finding(s) not triaged`);
        }
      }
      if (!isNonEmptyArray(e.selfReview)) missing.push('evidence.selfReview — the checklist the agent walked');
      return missing;
    },
  },
  {
    id: 'ship',
    phase: 'SHIP',
    principle: 'Faster is safer',
    summary: 'A PR description a human can review, a rollback plan, and a note on docs — launch is a checklist, not a leap.',
    requires(bundle) {
      const r = bundle.evidence?.release;
      const missing = [];
      if (!r || typeof r !== 'object') return ['no release evidence — nothing describes what is being shipped or how to undo it'];
      if (!isNonEmptyString(r.prDescription)) missing.push('release.prDescription — what a reviewer is approving');
      if (!isNonEmptyString(r.rollback)) missing.push('release.rollback — how this comes back if it is wrong');
      if (!isNonEmptyString(r.docsNote)) missing.push('release.docsNote — docs updated, or why none were needed');
      return missing;
    },
  },
];

// --- The gate runner ----------------------------------------------------------
// Ordered evaluation: the first failing gate blocks the run and later gates
// are reported 'skipped' — shipping is decided at the first broken promise.

export function evaluateBundle(bundle) {
  const rationalizations = scanRationalizations(bundle);
  const results = [];
  let blockedAt = null;

  for (const gate of GATES) {
    if (blockedAt) {
      results.push({ gate: gate.id, phase: gate.phase, principle: gate.principle, status: 'skipped' });
      continue;
    }
    const missing = gate.requires(bundle);
    const excuses = rationalizations.filter(r => r.gate === gate.id);
    const status = missing.length === 0 && excuses.length === 0 ? 'pass' : 'fail';
    if (status === 'fail') blockedAt = gate.id;
    results.push({ gate: gate.id, phase: gate.phase, principle: gate.principle, status, missing, rationalizations: excuses });
  }

  return {
    verdict: blockedAt ? 'blocked' : 'pass',
    blockedAt,
    results,
    rationalizations,
  };
}

// Format one gate result as a short line for the CLI/UI.
export function fmtResult(r) {
  if (r.status === 'skipped') return `${r.phase.padEnd(6)}  SKIPPED — blocked upstream`;
  if (r.status === 'pass') return `${r.phase.padEnd(6)}  PASS — ${r.principle}`;
  const bits = [];
  if (r.missing?.length) bits.push(`${r.missing.length} missing: ${r.missing.join('; ')}`);
  if (r.rationalizations?.length) bits.push(`${r.rationalizations.length} excuse(s): ${r.rationalizations.map(x => x.excuse).join(' ')}`);
  return `${r.phase.padEnd(6)}  FAIL — ${bits.join(' · ') || 'failed'}`;
}
