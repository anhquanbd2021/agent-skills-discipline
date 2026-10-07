# Gatekeeper — companion demo

Interactive lab for the article *Your Coding Agent Doesn't Need a Better
Model — It Needs a Quality Gate*, inspired by the structure of
[`addyosmani/agent-skills`](https://github.com/addyosmani/agent-skills):
ordered lifecycle phases, evidence requirements, and anti-rationalization.

Three scripted agents submit "change bundles" — a diff plus whatever process
evidence they bothered to collect. Six ordered gates (define → plan → build
→ verify → review → ship) evaluate each bundle. The first failing gate
blocks the run; a rationalization scanner flags excuse phrases and pins
them to the gate they try to bypass.

Zero dependencies — Node 20+ only. The gate engine and the three bundles
are plain ES modules shared by the browser UI, the CLI, and the test suite.

## The three agents

| Agent | What it submits | Where it lands |
|---|---|---|
| **sloppy** | Real spec + plan, small diff — but no test run, no runtime check on a changed `.html` file, and three excuses ("probably works", "clicked through it", "I'll add tests later"). | **BLOCKED at VERIFY** — 2 missing evidence items, excuses flagged. |
| **rationalized** | Every evidence slot filled: spec, plan, clean test report, a security scan, a release record. But the scan's 2 findings are untriaged, the self-review list is empty — and it claims "low-risk, triage after merge." | **BLOCKED at REVIEW** — evidence present ≠ evidence adequate. |
| **disciplined** | The same discount-code feature as sloppy, with the full evidence chain: spec criteria, per-task verify steps, `npm test` counts, a DevTools runtime check, a clean scan, a self-review, a rollback plan. | **PASS — all six gates.** |

## What the gates check

- **DEFINE** — spec with objectives *and* acceptance criteria.
- **PLAN** — tasks, each with its own `verify` step.
- **BUILD** — a reviewable diff: ≤ 12 files, ≤ 400 insertions.
- **VERIFY** — a test report (command + counts, `failed === 0`), plus a
  runtime check when the diff touches UI files.
- **REVIEW** — a security scan with triaged findings + a self-review list.
- **SHIP** — PR description, rollback plan, docs note.

A claim in free text never satisfies a contract — and seven
rationalization patterns ("tests later", "probably works", "too small",
"flaky", "clicked through", "triage after merge", "ship it now") actively
fail the gate they target.

## Run it

```text
npm start        # serve the lab on :3000 (PORT env to change)
npm test         # gates, rationalizations, bundles, server — 20 tests
npm run report   # side-by-side CLI verdict for all three agents
npm run check    # both
```

## Honest limits

- **Presence ≠ truth.** The engine checks that evidence exists and is
  well-formed — it cannot tell whether a test report is real. In
  production, CI produces the evidence; here, the fixture JSON does.
- **The scanner is a string match.** It catches phrased excuses, not
  sophisticated ones — a model could learn to phrase around it. Real
  anti-rationalization lives in review culture, not regex.
- **Markdown is persuasive, not enforced.** The actual Agent Skills pack
  is instructions an agent can still ignore; this lab models the *ideal* —
  a gate that cannot be talked past.
- **Thresholds are illustrative.** 12 files / 400 insertions are teaching
  numbers, not universal limits; the pack argues for ~100-line reviewable
  changes.

This is an educational demo, not production infrastructure.
