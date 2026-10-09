import crypto from 'node:crypto';

const COOKIE_VERSION = 'v1';
const LINK_TICKET_VERSION = 'link-v1';

function toBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

/**
 * Produce a short-lived, tamper-evident browser-verification session.
 * This is intentionally not an identity or login token; it only records that
 * a Turnstile challenge was recently validated by this server.
 */
export function createHumanSession(secret, { now = Date.now(), ttlSeconds = 60 * 60 * 12 } = {}) {
  const issuedAt = Math.floor(now / 1000);
  const payload = toBase64Url(JSON.stringify({ iat: issuedAt, exp: issuedAt + ttlSeconds }));
  const unsigned = `${COOKIE_VERSION}.${payload}`;
  return `${unsigned}.${sign(unsigned, secret)}`;
}

export function verifyHumanSession(value, secret, { now = Date.now() } = {}) {
  if (typeof value !== 'string' || value.length > 1024) return false;
  const [version, payload, signature, extra] = value.split('.');
  if (version !== COOKIE_VERSION || !payload || !signature || extra) return false;

  const unsigned = `${version}.${payload}`;
  const expected = Buffer.from(sign(unsigned, secret));
  const supplied = Buffer.from(signature);
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return false;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const nowSeconds = Math.floor(now / 1000);
    return Number.isInteger(session.iat)
      && Number.isInteger(session.exp)
      && session.iat <= nowSeconds + 60
      && session.exp > nowSeconds;
  } catch {
    return false;
  }
}

/**
 * Issue a short-lived, item-scoped redirect ticket. The ticket is deliberately
 * not a destination URL: only the redirect handler can look up and release the
 * final URL after validating it.
 */
export function createLinkAccessTicket(secret, contentId, { now = Date.now(), ttlSeconds = 120 } = {}) {
  const issuedAt = Math.floor(now / 1000);
  const payload = toBase64Url(JSON.stringify({ contentId, iat: issuedAt, exp: issuedAt + ttlSeconds }));
  const unsigned = `${LINK_TICKET_VERSION}.${payload}`;
  return `${unsigned}.${sign(unsigned, secret)}`;
}

export function verifyLinkAccessTicket(value, secret, contentId, { now = Date.now() } = {}) {
  if (typeof value !== 'string' || value.length > 2048 || typeof contentId !== 'string') return false;
  const [version, payload, signature, extra] = value.split('.');
  if (version !== LINK_TICKET_VERSION || !payload || !signature || extra) return false;

  const unsigned = `${version}.${payload}`;
  const expected = Buffer.from(sign(unsigned, secret));
  const supplied = Buffer.from(signature);
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return false;

  try {
    const ticket = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const nowSeconds = Math.floor(now / 1000);
    return ticket.contentId === contentId
      && Number.isInteger(ticket.iat)
      && Number.isInteger(ticket.exp)
      && ticket.iat <= nowSeconds + 60
      && ticket.exp > nowSeconds;
  } catch {
    return false;
  }
}

export function readCookie(header, name) {
  if (typeof header !== 'string') return null;
  const prefix = `${name}=`;
  return header.split(';').map(value => value.trim()).find(value => value.startsWith(prefix))?.slice(prefix.length) || null;
}
