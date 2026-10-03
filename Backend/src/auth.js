import crypto from 'node:crypto';
import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { config } from './config.js';
import { deletePrivateKey, getPrivateJson, setPrivateJson } from './cache.js';
import { pool } from './db.js';

const STATE_TTL_SECONDS = 10 * 60;
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const GOOGLE_AUTHORIZATION_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const passwordSchema = z.string().min(12, 'Use at least 12 characters.').max(128, 'Password is too long.');
const signUpSchema = z.object({
  displayName: z.string().trim().min(1, 'Enter your name.').max(80, 'Name is too long.'),
  email: z.string().trim().email('Enter a valid email address.').max(254),
  password: passwordSchema,
  returnTo: z.string().optional(),
});
const signInSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.').max(254),
  password: z.string().min(1, 'Enter your password.').max(128),
  returnTo: z.string().optional(),
});

function googleConfigured() {
  return Boolean(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET && config.GOOGLE_REDIRECT_URI && config.SESSION_SECRET);
}

function sessionConfigured() { return Boolean(config.SESSION_SECRET); }

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('base64url');
}

function sessionKey(sessionId) {
  return crypto.createHmac('sha256', config.SESSION_SECRET).update(sessionId).digest('base64url');
}

function cookieOptions(maxAge = SESSION_TTL_SECONDS * 1000) {
  return {
    httpOnly: true,
    secure: new URL(config.FRONTEND_ORIGIN).protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge,
  };
}

function readCookie(req, name) {
  const cookie = req.headers.cookie || '';
  const prefix = `${name}=`;
  return cookie.split(';').map(part => part.trim()).find(part => part.startsWith(prefix))?.slice(prefix.length) || null;
}

function safeReturnTo(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/discover';
}

function noStore(res) {
  res.set('Cache-Control', 'no-store, private');
}

function publicUser(row) {
  return { id: row.id, email: row.email, displayName: row.displayName, plan: row.plan };
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('base64url')) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(`${salt}:${derivedKey.toString('base64url')}`);
    });
  });
}

async function verifyPassword(password, storedHash) {
  if (typeof storedHash !== 'string') return false;
  const [salt, expected] = storedHash.split(':');
  if (!salt || !expected) return false;
  const calculated = await hashPassword(password, salt);
  const actual = Buffer.from(calculated.split(':')[1], 'base64url');
  const wanted = Buffer.from(expected, 'base64url');
  return actual.length === wanted.length && crypto.timingSafeEqual(actual, wanted);
}

async function issueSession(user, res) {
  if (!sessionConfigured()) return false;
  const sessionId = randomToken(32);
  const stored = await setPrivateJson(`auth:session:${sessionKey(sessionId)}`, { userId: user.id }, SESSION_TTL_SECONDS);
  if (!stored) return false;
  res.cookie(config.SESSION_COOKIE_NAME, sessionId, cookieOptions());
  return true;
}

async function findOrCreateUser({ subject, email, name }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existingIdentity = await client.query(`
      SELECT user_id AS "userId" FROM oauth_identities
      WHERE provider = 'google' AND provider_subject = $1
    `, [subject]);
    let userId = existingIdentity.rows[0]?.userId;
    const emailNormalized = email.toLowerCase();
    if (!userId) {
      const existingUser = await client.query('SELECT id FROM users WHERE email_normalized = $1', [emailNormalized]);
      userId = existingUser.rows[0]?.id || crypto.randomUUID();
      if (existingUser.rows[0]) {
        await client.query('UPDATE users SET display_name = COALESCE(NULLIF($2, \'\'), display_name), updated_at = NOW() WHERE id = $1', [userId, name || '']);
      } else {
        await client.query(`
          INSERT INTO users (id, email, email_normalized, display_name, plan)
          VALUES ($1, $2, $3, $4, 'free')
        `, [userId, email, emailNormalized, name || email.split('@')[0]]);
      }
      await client.query(`
        INSERT INTO oauth_identities (provider, provider_subject, user_id, email_at_link)
        VALUES ('google', $1, $2, $3)
        ON CONFLICT (provider, provider_subject) DO NOTHING
      `, [subject, userId, email]);
    } else {
      await client.query(`
        UPDATE users SET email = $2, email_normalized = $3,
          display_name = COALESCE(NULLIF($4, ''), display_name), updated_at = NOW()
        WHERE id = $1
      `, [userId, email, emailNormalized, name || '']);
    }
    const user = await client.query('SELECT id, email, display_name AS "displayName", plan FROM users WHERE id = $1', [userId]);
    await client.query('COMMIT');
    return user.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function createPasswordUser({ displayName, email, password }) {
  const emailNormalized = email.toLowerCase();
  const passwordHash = await hashPassword(password);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT id FROM users WHERE email_normalized = $1', [emailNormalized]);
    if (existing.rowCount) {
      const error = new Error('An account already exists for this email.');
      error.code = 'ACCOUNT_EXISTS';
      throw error;
    }
    const id = crypto.randomUUID();
    const result = await client.query(`
      INSERT INTO users (id, email, email_normalized, display_name, password_hash, plan)
      VALUES ($1, $2, $3, $4, $5, 'free')
      RETURNING id, email, display_name AS "displayName", plan
    `, [id, email, emailNormalized, displayName, passwordHash]);
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getSessionUser(req) {
  if (!sessionConfigured()) return null;
  const sessionId = readCookie(req, config.SESSION_COOKIE_NAME);
  if (!sessionId || sessionId.length > 160) return null;
  const session = await getPrivateJson(`auth:session:${sessionKey(sessionId)}`);
  if (!session?.userId) return null;
  const result = await pool.query('SELECT id, email, display_name AS "displayName", plan FROM users WHERE id = $1', [session.userId]);
  return result.rows[0] || null;
}

export const authRouter = express.Router();

authRouter.get('/google', async (req, res, next) => {
  noStore(res);
  if (!googleConfigured()) return res.status(503).json({ error: 'Google sign-in is not configured.' });
  try {
    const state = randomToken();
    const nonce = randomToken();
    const verifier = randomToken(48);
    const stored = await setPrivateJson(`auth:google:state:${state}`, { nonce, verifier, returnTo: safeReturnTo(req.query.returnTo) }, STATE_TTL_SECONDS);
    if (!stored) return res.status(503).json({ error: 'Sign-in is temporarily unavailable.' });
    const url = new URL(GOOGLE_AUTHORIZATION_URL);
    url.search = new URLSearchParams({
      client_id: config.GOOGLE_CLIENT_ID,
      redirect_uri: config.GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: sha256(verifier),
      code_challenge_method: 'S256',
      prompt: 'select_account',
    }).toString();
    res.redirect(url.toString());
  } catch (error) { next(error); }
});

authRouter.get('/google/callback', async (req, res, next) => {
  noStore(res);
  if (!googleConfigured()) return res.status(503).send('Google sign-in is not configured.');
  const { code, state, error } = req.query;
  if (error) return res.redirect(`${config.FRONTEND_ORIGIN}/auth/sign-in?error=google_cancelled`);
  if (typeof state !== 'string' || typeof code !== 'string' || state.length > 160 || code.length > 2048) return res.redirect(`${config.FRONTEND_ORIGIN}/auth/sign-in?error=google_invalid`);
  try {
    const stateKey = `auth:google:state:${state}`;
    const saved = await getPrivateJson(stateKey);
    await deletePrivateKey(stateKey);
    if (!saved?.nonce || !saved?.verifier) return res.redirect(`${config.FRONTEND_ORIGIN}/auth/sign-in?error=google_expired`);
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.GOOGLE_CLIENT_ID,
        client_secret: config.GOOGLE_CLIENT_SECRET,
        redirect_uri: config.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
        code_verifier: saved.verifier,
      }),
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || typeof tokens.id_token !== 'string') throw new Error('Google token exchange failed');
    const google = new OAuth2Client(config.GOOGLE_CLIENT_ID);
    const ticket = await google.verifyIdToken({ idToken: tokens.id_token, audience: config.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload?.sub || payload.nonce !== saved.nonce || !payload.email || payload.email_verified !== true) throw new Error('Google identity validation failed');
    const user = await findOrCreateUser({ subject: payload.sub, email: payload.email, name: payload.name });
    if (!await issueSession(user, res)) return res.status(503).send('Sign-in is temporarily unavailable.');
    res.redirect(`${config.FRONTEND_ORIGIN}${safeReturnTo(saved.returnTo)}`);
  } catch (error) { next(error); }
});

authRouter.post('/sign-up', async (req, res, next) => {
  noStore(res);
  if (!sessionConfigured()) return res.status(503).json({ error: 'Sign-up is not configured.' });
  const parsed = signUpSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Please correct the highlighted fields.', fields: parsed.error.flatten().fieldErrors });
  try {
    const user = await createPasswordUser(parsed.data);
    if (!await issueSession(user, res)) return res.status(503).json({ error: 'Sign-up is temporarily unavailable.' });
    res.status(201).json({ user: publicUser(user), redirectTo: safeReturnTo(parsed.data.returnTo) });
  } catch (error) {
    if (error.code === 'ACCOUNT_EXISTS' || error.code === '23505') return res.status(409).json({ error: 'An account already exists for this email. Sign in instead.' });
    next(error);
  }
});

authRouter.post('/sign-in', async (req, res, next) => {
  noStore(res);
  if (!sessionConfigured()) return res.status(503).json({ error: 'Sign-in is not configured.' });
  const parsed = signInSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter your email address and password.' });
  try {
    const result = await pool.query(`
      SELECT id, email, display_name AS "displayName", password_hash AS "passwordHash", plan
      FROM users WHERE email_normalized = $1
    `, [parsed.data.email.toLowerCase()]);
    const user = result.rows[0];
    if (!user || !await verifyPassword(parsed.data.password, user.passwordHash)) return res.status(401).json({ error: 'Incorrect email or password.' });
    if (!await issueSession(user, res)) return res.status(503).json({ error: 'Sign-in is temporarily unavailable.' });
    res.json({ user: publicUser(user), redirectTo: safeReturnTo(parsed.data.returnTo) });
  } catch (error) { next(error); }
});

authRouter.get('/me', async (req, res, next) => {
  noStore(res);
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ user: null });
    res.json({ user });
  } catch (error) { next(error); }
});

authRouter.post('/logout', async (req, res, next) => {
  noStore(res);
  try {
    const sessionId = readCookie(req, config.SESSION_COOKIE_NAME);
    if (sessionId && sessionConfigured()) await deletePrivateKey(`auth:session:${sessionKey(sessionId)}`);
    res.clearCookie(config.SESSION_COOKIE_NAME, cookieOptions(0));
    res.status(204).end();
  } catch (error) { next(error); }
});
