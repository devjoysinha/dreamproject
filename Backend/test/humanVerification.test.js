import test from 'node:test';
import assert from 'node:assert/strict';
import { createHumanSession, createLinkAccessTicket, readCookie, verifyHumanSession, verifyLinkAccessTicket } from '../src/humanVerification.js';

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

test('link tickets are short-lived and only work for their intended content item', () => {
  const ticket = createLinkAccessTicket(secret, 'a-linked-content-id', { now: 1_000_000, ttlSeconds: 120 });
  assert.equal(verifyLinkAccessTicket(ticket, secret, 'a-linked-content-id', { now: 1_050_000 }), true);
  assert.equal(verifyLinkAccessTicket(ticket, secret, 'another-content-id', { now: 1_050_000 }), false);
  assert.equal(verifyLinkAccessTicket(ticket, secret, 'a-linked-content-id', { now: 1_121_000 }), false);
  assert.equal(verifyLinkAccessTicket(`${ticket}x`, secret, 'a-linked-content-id', { now: 1_050_000 }), false);
});
