import crypto from 'node:crypto';

const COOKIE_VERSION = 'v1';

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

export function readCookie(header, name) {
  if (typeof header !== 'string') return null;
  const prefix = `${name}=`;
  return header.split(';').map(value => value.trim()).find(value => value.startsWith(prefix))?.slice(prefix.length) || null;
}
