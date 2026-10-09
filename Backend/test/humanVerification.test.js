import test from 'node:test';
import assert from 'node:assert/strict';
import { createHumanSession, readCookie, verifyHumanSession } from '../src/humanVerification.js';

const secret = 'this-is-a-test-secret-that-is-long-enough-to-be-safe';

test('human verification sessions are valid only until their expiry', () => {
  const session = createHumanSession(secret, { now: 1_000_000, ttlSeconds: 300 });
  assert.equal(verifyHumanSession(session, secret, { now: 1_100_000 }), true);
  assert.equal(verifyHumanSession(session, secret, { now: 1_301_000 }), false);
});

test('human verification sessions cannot be modified or signed with a different secret', () => {
  const session = createHumanSession(secret, { now: 1_000_000, ttlSeconds: 300 });
  assert.equal(verifyHumanSession(`${session}x`, secret, { now: 1_100_000 }), false);
  assert.equal(verifyHumanSession(session, `${secret}-other`, { now: 1_100_000 }), false);
});

test('cookie lookup reads an exact cookie name', () => {
  assert.equal(readCookie('other=value; lp_human=verified; lp_human_old=no', 'lp_human'), 'verified');
  assert.equal(readCookie('lp_human_old=no', 'lp_human'), null);
});
