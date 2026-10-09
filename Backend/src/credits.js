import { pool } from './db.js';

const INITIAL_CREDITS = 30;
const COST_PER_OPEN = 10;

export async function getVisitorCredits(fingerprint) {
  if (!fingerprint) return null;
  const { rows } = await pool.query(
    'SELECT id, credits, opens_used FROM visitor_credits WHERE fingerprint = $1',
    [fingerprint],
  );
  return rows[0] || null;
}

export async function getOrCreateVisitor(fingerprint) {
  if (!fingerprint) return { credits: 0, opens_used: 0 };
  const { rows } = await pool.query(
    `INSERT INTO visitor_credits (fingerprint, credits, opens_used)
     VALUES ($1, $2, 0)
     ON CONFLICT (fingerprint) DO UPDATE SET updated_at = now()
     RETURNING id, credits, opens_used`,
    [fingerprint, INITIAL_CREDITS],
  );
  return rows[0];
}

export async function deductCredits(fingerprint) {
  const { rows } = await pool.query(
    `UPDATE visitor_credits
     SET credits = credits - $1, opens_used = opens_used + 1, updated_at = now()
     WHERE fingerprint = $2 AND credits >= $1
     RETURNING id, credits, opens_used`,
    [COST_PER_OPEN, fingerprint],
  );
  return rows[0] || null;
}

export async function addCredits(fingerprint, amount) {
  const { rows } = await pool.query(
    `UPDATE visitor_credits
     SET credits = credits + $1, updated_at = now()
     WHERE fingerprint = $2
     RETURNING id, credits, opens_used`,
    [amount, fingerprint],
  );
  return rows[0] || null;
}

export { INITIAL_CREDITS, COST_PER_OPEN };
