import { evaluateBundle, GATES, RATIONALIZATIONS } from '/gates.mjs';
import { BUNDLES } from '/bundles.mjs';

const pipelineEl = document.getElementById('pipeline');
const verdictEl = document.getElementById('verdict');
const findingsEl = document.getElementById('findings');
const agentsEl = document.getElementById('agents');
const cardEl = document.getElementById('bundle-card');
const excusesEl = document.getElementById('excuses');

// Render the static excuse table once.
excusesEl.replaceChildren(...RATIONALIZATIONS.map(r => {
  const li = document.createElement('li');
  const q = document.createElement('span');
  q.className = 'excuse-quote';
  q.textContent = r.excuse;
  const meta = document.createElement('span');
  meta.className = 'excuse-meta';
  meta.textContent = `→ ${r.gate.toUpperCase()} gate. ${r.rebuttal}`;
  li.append(q, meta);
  return li;
}));

function renderAgentButtons() {
  agentsEl.replaceChildren(...Object.values(BUNDLES).map(b => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.id = b.id;
    btn.innerHTML = `<strong>${b.id}</strong><small>${b.agent}</small>`;
    btn.addEventListener('click', () => runBundle(b.id));
    return btn;
  }));
}

function renderCard(bundle) {
  cardEl.replaceChildren();
  const title = document.createElement('h3');
  title.textContent = `“${bundle.title}”`;
  const diff = document.createElement('p');
  diff.className = 'muted';
  diff.textContent = `diff: ${bundle.diff.files.length} files, +${bundle.diff.insertions}/-${bundle.diff.deletions}`;
  const claims = document.createElement('ul');
  claims.className = 'claims';
  for (const c of bundle.claims) {
    const li = document.createElement('li');
    li.textContent = `“${c.text}”`;
    claims.append(li);
  }
  cardEl.append(title, diff, claims);
}

function buildPipeline() {
  pipelineEl.replaceChildren(...GATES.map(g => {
    const li = document.createElement('li');
    li.className = 'gate pending';
    li.dataset.gate = g.id;
    li.innerHTML = `<span class="gate-phase">${g.phase}</span><span class="gate-principle">${g.principle}</span>`;
    return li;
  }));
}

async function runBundle(id) {
  const bundle = BUNDLES[id];
  for (const b of agentsEl.querySelectorAll('button')) b.disabled = true;
  renderCard(bundle);
  buildPipeline();
  findingsEl.replaceChildren();
  verdictEl.className = 'badge';
  verdictEl.textContent = 'Evaluating…';

  const run = evaluateBundle(bundle);
  const chips = [...pipelineEl.children];

  // Reveal one gate at a time so the block is visible, not just the verdict.
  for (const [i, r] of run.results.entries()) {
    await new Promise(res => setTimeout(res, 420));
    const chip = chips[i];
    chip.className = `gate ${r.status}`;
    if (r.status === 'fail') chip.querySelector('.gate-phase').textContent = `${r.phase} ✕`;
    if (r.status === 'pass') chip.querySelector('.gate-phase').textContent = `${r.phase} ✓`;
  }

  // Findings under the failing gate.
  const items = [];
  for (const r of run.results) {
    for (const m of r.missing || []) {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${r.phase}</strong> missing evidence — ${m}`;
      items.push(li);
    }
    for (const ex of r.rationalizations || []) {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${r.phase}</strong> excuse — <span class="excuse-quote">${ex.excuse}</span> <em>(matched “${ex.quote}”)</em>`;
      items.push(li);
    }
  }
  // Excuses aimed at gates the run never reached are still worth showing.
  const reached = new Set(run.results.filter(r => r.status !== 'skipped').map(r => r.gate));
  for (const ex of run.rationalizations.filter(e => !reached.has(e.gate))) {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${ex.gate.toUpperCase()}</strong> excuse heard early — <span class="excuse-quote">${ex.excuse}</span> <em>(matched “${ex.quote}”)</em>`;
    items.push(li);
  }
  if (items.length) {
    const list = document.createElement('ul');
    list.className = 'findings-list';
    list.append(...items);
    findingsEl.append(list);
  }

  verdictEl.className = `badge ${run.verdict === 'pass' ? 'pass' : 'fail'}`;
  verdictEl.textContent = run.verdict === 'pass' ? 'PASS — all six gates' : `BLOCKED at ${run.blockedAt.toUpperCase()}`;
  for (const b of agentsEl.querySelectorAll('button')) b.disabled = false;
}

renderAgentButtons();
buildPipeline();
