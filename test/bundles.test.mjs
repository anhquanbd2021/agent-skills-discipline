import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { BUNDLES } from '../public/bundles.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

test('embedded bundles match the JSON fixtures on disk', async () => {
  for (const [name, bundle] of Object.entries(BUNDLES)) {
    const raw = await readFile(`${root}examples/${name}/bundle.json`, 'utf8');
    assert.deepEqual(JSON.parse(raw), bundle, name);
  }
});

test('every bundle has the required shape', () => {
  for (const [name, b] of Object.entries(BUNDLES)) {
    assert.ok(b.id === name, name);
    assert.ok(typeof b.title === 'string' && b.title.length > 0, name);
    assert.ok(Array.isArray(b.claims), name);
    assert.ok(Array.isArray(b.diff?.files) && b.diff.files.length > 0, name);
    assert.ok(typeof b.evidence === 'object', name);
  }
});
