// Gatekeeper — the three scripted agents' change bundles.
// The same bundles live in examples/<name>/bundle.json; test/bundles.test.mjs
// pins the embedded copies to the files on disk.
//
// All three agents were asked for the *same kind of work*. They differ only
// in process discipline — which is the whole point.

export const SLOPPY_BUNDLE = {
  id: 'sloppy',
  agent: 'Fast agent — ships first, checks later',
  title: 'Add discount-code field to checkout',
  summary: 'Adds a discount input to checkout and applies the percentage to the total. Probably works — clicked through the flow once and the price updated.',
  claims: [
    { text: 'The change is small and self-contained.' },
    { text: "I'll add tests later, once the discount rules settle." },
    { text: 'Probably works — clicked through checkout once and the total updated.' },
  ],
  diff: {
    files: ['src/checkout.html', 'src/discount.js', 'src/cart.js'],
    insertions: 148,
    deletions: 22,
  },
  evidence: {
    spec: {
      objectives: ['Let shoppers apply a discount code at checkout.'],
      acceptanceCriteria: [
        'A valid code reduces the total by its percentage.',
        'An invalid code is rejected with a visible message.',
      ],
    },
    plan: {
      tasks: [
        { title: 'Add discount input to checkout template', verify: 'Field renders and accepts a code' },
        { title: 'Apply percentage to total in cart.js', verify: 'Total reflects the discount' },
      ],
    },
    release: {
      prDescription: 'Adds discount code support to checkout.',
      rollback: 'Revert the commit; the field is additive.',
      docsNote: 'Will update the checkout docs if this ships.',
    },
  },
};

export const RATIONALIZED_BUNDLE = {
  id: 'rationalized',
  agent: 'Checkbox agent — every slot filled, nothing verified',
  title: 'Cache the product catalog in memory',
  summary: 'Adds an in-memory cache for the product catalog to cut database reads on hot paths.',
  claims: [
    { text: 'Ran the full suite — clean.' },
    { text: "The scan findings are low-risk — I'll triage them after merge." },
    { text: 'Ship it now; the latency win is worth more than a checklist.' },
  ],
  diff: {
    files: ['src/catalog.js', 'src/cache.js', 'src/routes/api.js', 'src/config.js'],
    insertions: 236,
    deletions: 41,
  },
  evidence: {
    spec: {
      objectives: ['Cut catalog database reads on hot paths.'],
      acceptanceCriteria: [
        'Catalog endpoint p95 latency drops below 200 ms.',
        'Cache invalidates on product update.',
      ],
    },
    plan: {
      tasks: [
        { title: 'Add cache module with TTL', verify: 'Unit test TTL expiry' },
        { title: 'Wire cache into catalog route', verify: 'Second identical request served from cache' },
        { title: 'Invalidate on product writes', verify: 'Update a product, confirm fresh read' },
      ],
    },
    testReport: { command: 'npm test', passed: 121, failed: 0 },
    securityScan: {
      tool: 'npm audit + manual pass',
      findings: [
        'cache key built from unsanitized query param',
        'cache has no maximum size — unbounded growth',
      ],
      triaged: false,
    },
    selfReview: [],
    release: {
      prDescription: 'Adds catalog caching.',
      rollback: 'Revert the merge.',
      docsNote: 'Added cache notes to README.',
    },
  },
};

export const DISCIPLINED_BUNDLE = {
  id: 'disciplined',
  agent: 'Skilled agent — evidence at every gate',
  title: 'Add discount-code field to checkout',
  summary: 'Adds a discount input to checkout, applies the percentage in integer cents, and proves each gate with attached evidence.',
  claims: [
    { text: 'Tests: 14 pass / 0 fail — npm test output is in the report.' },
    { text: 'Verified in-browser: invalid codes are rejected, a valid code updates the total.' },
  ],
  diff: {
    files: [
      'src/checkout.html',
      'src/discount.js',
      'src/cart.js',
      'test/discount.test.js',
      'test/cart.test.js',
      'docs/checkout.md',
    ],
    insertions: 184,
    deletions: 30,
  },
  evidence: {
    spec: {
      objectives: ['Let shoppers apply a discount code at checkout.'],
      acceptanceCriteria: [
        'A valid code reduces the total by its percentage, computed in integer cents.',
        'An invalid or expired code is rejected with a visible message; the total is unchanged.',
      ],
      outOfScope: ['Stackable codes', 'Code creation UI'],
    },
    plan: {
      tasks: [
        { title: 'Add discount input to checkout template', verify: 'Field renders; empty submit is a no-op' },
        { title: 'Implement discount.js validation + math in cents', verify: 'npm test test/discount.test.js' },
        { title: 'Apply discount in cart.js total', verify: 'npm test test/cart.test.js' },
        { title: 'Verify the flow end-to-end in a browser', verify: 'DevTools session notes attached' },
      ],
    },
    testReport: { command: 'npm test', passed: 14, failed: 0 },
    runtimeCheck: {
      tool: 'Chrome DevTools MCP',
      observations: [
        'discount field renders in checkout.html',
        'invalid code shows the error banner; total unchanged',
        'code SAVE10 updates total $40.00 → $36.00',
        'console clean; no failed network requests',
      ],
    },
    securityScan: { tool: 'npm audit + manual OWASP pass', findings: [], triaged: true },
    selfReview: [
      'diff is one concern, under 200 lines',
      'no secrets or PII in the diff',
      'money math uses integer cents, not floats',
      'error path returns a safe message, not a stack',
    ],
    release: {
      prDescription: 'Adds discount-code support behind flag DISCOUNT_V2: input, validation in integer cents, and a rejection path that leaves the total untouched. Includes unit tests and a DevTools verification log.',
      rollback: 'Set flag DISCOUNT_V2=off (instant), or revert commit; the field is additive and gated.',
      docsNote: 'docs/checkout.md updated with discount behavior and flag.',
    },
  },
};

export const BUNDLES = {
  sloppy: SLOPPY_BUNDLE,
  rationalized: RATIONALIZED_BUNDLE,
  disciplined: DISCIPLINED_BUNDLE,
};
