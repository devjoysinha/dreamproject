import test from 'node:test';
import assert from 'node:assert/strict';
import { slugify, stableId } from '../src/slug.js';

test('slugify creates stable URL-safe model slugs', () => {
  assert.equal(slugify(' Aishah Sofey '), 'aishah-sofey');
  assert.equal(slugify('Mía & Co.'), 'mia-co');
});

test('stableId is deterministic and namespaced', () => {
  assert.equal(stableId('mdl', 'https://example.test/model/a'), stableId('mdl', 'https://example.test/model/a'));
  assert.notEqual(stableId('mdl', 'a'), stableId('run', 'a'));
});
