import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

function readLocalGoogleCredentials() {
  const requestedPath = process.env.GOOGLE_OAUTH_CREDENTIALS_FILE;
  const candidates = requestedPath ? [requestedPath] : (() => {
    try {
      return fs.readdirSync(process.cwd())
        .filter(file => /^client_secret_.*\.json$/i.test(file))
        .map(file => path.join(process.cwd(), file));
    } catch { return []; }
  })();
  if (candidates.length === 0) return null;
  if (candidates.length > 1) throw new Error('Set GOOGLE_OAUTH_CREDENTIALS_FILE to the one Google OAuth credential file to use.');
  try {
    const credentials = JSON.parse(fs.readFileSync(candidates[0], 'utf8')).web;
    if (!credentials?.client_id || !credentials?.client_secret) throw new Error('missing web credentials');
    return credentials;
  } catch (error) {
    throw new Error(`Unable to load Google OAuth credentials: ${error.message}`);
  }
}

const localGoogleCredentials = readLocalGoogleCredentials();
const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
// Local development may use the ignored Google JSON downloaded from Google Cloud.
// Production must set explicit environment variables; it never falls back to a file.
const localSessionSecret = process.env.NODE_ENV === 'production'
  ? undefined
  : (localGoogleCredentials
    ? crypto.createHash('sha256').update(`leakporns-local-session:${localGoogleCredentials.client_secret}`).digest('hex')
    : crypto.randomBytes(48).toString('hex'));

const schema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().default('127.0.0.1'),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:3000'),
  MODEL_DATA_DIR: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  SESSION_COOKIE_NAME: z.string().regex(/^[a-zA-Z0-9_-]+$/).default('lp_session'),
  HUMAN_VERIFICATION_ENABLED: z.enum(['true', 'false']).default('false').transform(value => value === 'true'),
  HUMAN_VERIFICATION_SECRET: z.string().min(32).optional(),
  HUMAN_VERIFICATION_COOKIE_NAME: z.string().regex(/^[a-zA-Z0-9_-]+$/).default('lp_human'),
  HUMAN_VERIFICATION_TTL_SECONDS: z.coerce.number().int().min(300).max(60 * 60 * 24).default(60 * 60 * 12),
  LINK_ACCESS_TTL_SECONDS: z.coerce.number().int().min(30).max(600).default(120),
  CAP_API_ENDPOINT: z.string().url().optional(),
  CAP_SECRET_KEY: z.string().min(1).optional(),
  NOWPAYMENTS_API_KEY: z.string().optional().transform(v => v || undefined),
  NOWPAYMENTS_IPN_SECRET: z.string().optional().transform(v => v || undefined),
  NOWPAYMENTS_PRICE_USD: z.coerce.number().positive().default(0.22),
});

const parsedConfig = schema.parse({
  ...process.env,
  FRONTEND_ORIGIN: frontendOrigin,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || localGoogleCredentials?.client_id,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || localGoogleCredentials?.client_secret,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || (localGoogleCredentials ? `${frontendOrigin}/api/auth/google/callback` : undefined),
  SESSION_SECRET: process.env.SESSION_SECRET || localSessionSecret,
});

if (parsedConfig.HUMAN_VERIFICATION_ENABLED) {
  const required = ['HUMAN_VERIFICATION_SECRET', 'CAP_API_ENDPOINT', 'CAP_SECRET_KEY'];
  const missing = required.filter(key => !parsedConfig[key]);
  if (missing.length) throw new Error(`Human verification is enabled but ${missing.join(', ')} is missing.`);
}

export const config = parsedConfig;
