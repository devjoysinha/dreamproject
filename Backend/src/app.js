import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import { config } from './config.js';
import { pool } from './db.js';
import { getCachedJson, setCachedJson } from './cache.js';
import { authRouter } from './auth.js';
import { createHumanSession, createLinkAccessTicket, readCookie, verifyHumanSession, verifyLinkAccessTicket } from './humanVerification.js';

const listQuery = z.object({
  query: z.string().trim().max(120).optional(),
  tag: z.string().trim().max(160).optional(),
  ethnicity: z.enum(['arab', 'asian', 'ebony', 'indian', 'latina', 'white']).optional(),
  country: z.string().trim().regex(/^[a-z]{2}$/i).optional(),
  bodyType: z.string().trim().max(40).optional(),
  cupSize: z.string().trim().regex(/^[a-z]{1,3}$/i).optional(),
  sort: z.enum(['newest', 'name', 'links', 'hot']).default('newest'),
  limit: z.coerce.number().int().min(1).max(60).default(30),
  offset: z.coerce.number().int().min(0).default(0),
});
const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(60).default(24),
  offset: z.coerce.number().int().min(0).default(0),
});
const openLinksQuery = z.object({
  query: z.string().trim().max(120).optional(),
  ethnicity: z.enum(['arab', 'asian', 'ebony', 'indian', 'latina', 'white']).optional(),
  country: z.string().trim().regex(/^[a-z]{2}$/i).optional(),
  bodyType: z.string().trim().max(40).optional(),
  cupSize: z.string().trim().regex(/^[a-z]{1,3}$/i).optional(),
  sort: z.enum(['newest', 'trending', 'name']).default('newest'),
  limit: z.coerce.number().int().min(1).max(60).default(24),
  offset: z.coerce.number().int().min(0).default(0),
});
const openLinkParams = z.object({
  contentId: z.string().trim().min(1).max(128),
});
const linkAccessBody = z.object({
  token: z.string().min(20).max(4096).optional(),
});

const cardFields = `
  m.id, m.slug, m.name, m.profile_image_url AS "profileImageUrl",
  m.summary_display AS "summaryDisplay", m.source_query AS "sourceQuery", m.source_updated_at AS "updatedAt",
  COALESCE(link_counts.open_link_count, 0)::int AS "openLinkCount",
  COALESCE(link_counts.trending_count, 0)::int AS "trendingCount"`;
const cardJoins = `
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS open_link_count,
           COUNT(*) FILTER (WHERE media.is_trending)::int AS trending_count
    FROM model_open_links model_link
    JOIN media_items media ON media.content_id = model_link.content_id
    WHERE model_link.model_id = m.id
  ) link_counts ON TRUE`;

function ordering(sort) {
  return {
    newest: 'm.source_updated_at DESC NULLS LAST, m.name ASC',
    name: 'm.name ASC',
    links: 'link_counts.open_link_count DESC, m.name ASC',
    hot: 'link_counts.trending_count DESC, link_counts.open_link_count DESC, m.source_updated_at DESC NULLS LAST, m.name ASC',
  }[sort];
}

function openLinksOrdering(sort) {
  return {
    newest: 'item.created_at DESC NULLS LAST, item.title ASC',
    trending: 'item.is_trending DESC, item.created_at DESC NULLS LAST, item.title ASC',
    name: 'm.name ASC NULLS LAST, item.created_at DESC NULLS LAST',
  }[sort];
}

function parseOrRespond(schema, input, res) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request parameters', details: parsed.error.flatten().fieldErrors });
    return null;
  }
  return parsed.data;
}

function requestCacheKey(prefix, query) {
  return `dream:${prefix}:v1:${JSON.stringify(query)}`;
}

export const app = express();
app.disable('x-powered-by');
// The backend listens only on the loopback interface in production. Trust the
// local reverse proxy for the original address supplied by Cloudflare.
app.set('trust proxy', 'loopback');
app.use(cors({ origin: config.FRONTEND_ORIGIN, methods: ['GET'] }));
app.use(express.json({ limit: '100kb' }));

function hasHumanVerification(req) {
  if (!config.HUMAN_VERIFICATION_ENABLED) return true;
  const session = readCookie(req.headers.cookie, config.HUMAN_VERIFICATION_COOKIE_NAME);
  return Boolean(session && verifyHumanSession(session, config.HUMAN_VERIFICATION_SECRET));
}

function setHumanVerificationCookie(res) {
  const session = createHumanSession(config.HUMAN_VERIFICATION_SECRET, { ttlSeconds: config.HUMAN_VERIFICATION_TTL_SECONDS });
  res.cookie(config.HUMAN_VERIFICATION_COOKIE_NAME, session, {
    httpOnly: true,
    secure: new URL(config.FRONTEND_ORIGIN).protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: config.HUMAN_VERIFICATION_TTL_SECONDS * 1000,
  });
}

function linkTicketSecret() {
  // This makes ticket signing available in development before Turnstile is
  // enabled, while production verification uses its dedicated secret.
  return config.HUMAN_VERIFICATION_SECRET || config.SESSION_SECRET;
}

function isSafeExternalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

async function verifyCap(token) {
  const endpoint = config.CAP_API_ENDPOINT.replace(/\/$/, '');
  const response = await fetch(`${endpoint}/siteverify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: config.CAP_SECRET_KEY, response: token }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) return { success: false };
  const result = await response.json();
  return { success: result?.success === true };
}

app.get('/health', async (_req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
});

app.use('/api/auth', authRouter);

app.post('/api/open-links/:contentId/access', async (req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  const params = openLinkParams.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: 'Invalid content identifier.' });
  const body = linkAccessBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Invalid verification request.' });

  try {
    if (!hasHumanVerification(req)) {
      if (!body.data.token) return res.status(403).json({ error: 'Browser verification required.', verificationRequired: true });
      const outcome = await verifyCap(body.data.token);
      if (!outcome.success) return res.status(403).json({ error: 'Verification was not accepted. Please try again.', verificationRequired: true });
      setHumanVerificationCookie(res);
    }

    const destination = await pool.query(
      "SELECT mega_url FROM media_items WHERE content_id = $1 AND status = 'resolved' AND mega_url IS NOT NULL LIMIT 1",
      [params.data.contentId],
    );
    const destinationUrl = destination.rows[0]?.mega_url;
    if (!isSafeExternalUrl(destinationUrl)) return res.status(404).json({ error: 'This link is no longer available.' });

    const secret = linkTicketSecret();
    if (!secret) return res.status(503).json({ error: 'Secure link service is unavailable.' });
    const ticket = createLinkAccessTicket(secret, params.data.contentId, { ttlSeconds: config.LINK_ACCESS_TTL_SECONDS });
    const contentId = encodeURIComponent(params.data.contentId);
    res.json({ redirectUrl: `/api/open-links/${contentId}/redirect?ticket=${encodeURIComponent(ticket)}` });
  } catch (error) {
    next(error);
  }
});

app.get('/api/open-links/:contentId/redirect', async (req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  const params = openLinkParams.safeParse(req.params);
  const ticket = typeof req.query.ticket === 'string' ? req.query.ticket : '';
  const secret = linkTicketSecret();
  if (!params.success || !secret || !verifyLinkAccessTicket(ticket, secret, params.data.contentId)) {
    return res.status(403).json({ error: 'This secure link has expired. Please try again.' });
  }

  try {
    const destination = await pool.query(
      "SELECT mega_url FROM media_items WHERE content_id = $1 AND status = 'resolved' AND mega_url IS NOT NULL LIMIT 1",
      [params.data.contentId],
    );
    const destinationUrl = destination.rows[0]?.mega_url;
    if (!isSafeExternalUrl(destinationUrl)) return res.status(404).json({ error: 'This link is no longer available.' });
    res.redirect(302, destinationUrl);
  } catch (error) {
    next(error);
  }
});

app.get('/api/open-links', async (req, res, next) => {
  const query = parseOrRespond(openLinksQuery, req.query, res);
  if (!query) return;
  const cacheKey = requestCacheKey('open-links:v4', query);
  const cached = await getCachedJson(cacheKey);
  if (cached) return res.json(cached);
  const filters = ["item.mega_url IS NOT NULL", "item.status = 'resolved'"];
  const values = [];
  if (query.query) {
    values.push(`%${query.query}%`);
    filters.push(`(item.title ILIKE $${values.length} OR m.name ILIKE $${values.length} OR m.source_query ILIKE $${values.length})`);
  }
  if (query.ethnicity) {
    values.push(`%· ${query.ethnicity.toUpperCase()}%`);
    filters.push(`m.summary_display ILIKE $${values.length}`);
  }
  if (query.country) {
    values.push(`(^| · )${query.country.toUpperCase()}( · |$)`);
    filters.push(`m.summary_display ~ $${values.length}`);
  }
  if (query.bodyType) {
    values.push(query.bodyType);
    filters.push(`m.profile_meta->>'body' ILIKE $${values.length}`);
  }
  if (query.cupSize) {
    values.push(`(^|[0-9])${query.cupSize.toUpperCase()}(\\s|\\(|$)`);
    filters.push(`m.profile_meta->>'chest' ~* $${values.length}`);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  values.push(query.limit, query.offset);
  // A root-feed item is still a valid listing when its title cannot be matched to a
  // creator. Select one deterministic creator for cards that do have associations,
  // rather than duplicating a card when an item is associated with several models.
  const from = `FROM media_items item
    LEFT JOIN LATERAL (
      SELECT model.slug, model.name, model.source_query, model.summary_display, model.profile_meta
      FROM model_open_links relation
      JOIN models model ON model.id = relation.model_id
      WHERE relation.content_id = item.content_id
      ORDER BY relation.position ASC, model.name ASC
      LIMIT 1
    ) m ON TRUE`;
  const sql = `SELECT item.content_id AS id, item.short_code AS "shortCode", item.title, item.image_url AS "imageUrl", item.image_count AS images, item.video_count AS videos, item.size_bytes AS "sizeBytes", item.size_display AS "sizeDisplay", item.created_at AS "createdAt", item.relative_age AS "relativeAge", item.is_trending AS "isTrending", item.is_premium AS "isPremium", item.status, m.slug AS "modelSlug", m.name AS "modelName" ${from} ${where} ORDER BY ${openLinksOrdering(query.sort)} LIMIT $${values.length - 1} OFFSET $${values.length}`;
  const totalSql = `SELECT COUNT(*)::int AS total ${from} ${where}`;
  try {
    const [items, total] = await Promise.all([
      pool.query(sql, values),
      pool.query(totalSql, values.slice(0, -2)),
    ]);
    const payload = { items: items.rows, total: total.rows[0].total, limit: query.limit, offset: query.offset };
    await setCachedJson(cacheKey, payload, 20);
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

app.get('/api/models', async (req, res, next) => {
  const query = parseOrRespond(listQuery, req.query, res);
  if (!query) return;
  const cacheKey = requestCacheKey('models', query);
  const cached = await getCachedJson(cacheKey);
  if (cached) return res.json(cached);
  const filters = [];
  const values = [];
  if (query.query) {
    values.push(`%${query.query}%`);
    filters.push(`(m.name ILIKE $${values.length} OR m.summary_display ILIKE $${values.length})`);
  }
  if (query.tag) {
    values.push(query.tag);
    filters.push(`EXISTS (SELECT 1 FROM model_tags filter_tag WHERE filter_tag.model_id = m.id AND filter_tag.code = $${values.length})`);
  }
  if (query.ethnicity) {
    values.push(`%· ${query.ethnicity.toUpperCase()}%`);
    filters.push(`m.summary_display ILIKE $${values.length}`);
  }
  if (query.country) {
    values.push(`(^| · )${query.country.toUpperCase()}( · |$)`);
    filters.push(`m.summary_display ~ $${values.length}`);
  }
  if (query.bodyType) {
    values.push(query.bodyType);
    filters.push(`m.profile_meta->>'body' ILIKE $${values.length}`);
  }
  if (query.cupSize) {
    values.push(`(^|[0-9])${query.cupSize.toUpperCase()}(\\s|\\(|$)`);
    filters.push(`m.profile_meta->>'chest' ~* $${values.length}`);
  }
  // The models directory should only expose profiles that have usable open-link data.
  filters.push('link_counts.open_link_count > 0');
  values.push(query.limit, query.offset);
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const sql = `SELECT ${cardFields} FROM models m ${cardJoins} ${where} ORDER BY ${ordering(query.sort)} LIMIT $${values.length - 1} OFFSET $${values.length}`;
  const totalSql = `SELECT COUNT(*)::int AS total FROM models m ${cardJoins} ${where}`;
  try {
    const [items, total] = await Promise.all([
      pool.query(sql, values),
      pool.query(totalSql, values.slice(0, -2)),
    ]);
    const payload = { items: items.rows, total: total.rows[0].total, limit: query.limit, offset: query.offset };
    await setCachedJson(cacheKey, payload, 45);
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

app.get('/api/tags', async (_req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT tag.code, MIN(tag.label) AS label, COUNT(DISTINCT tag.model_id)::int AS "modelCount"
      FROM model_tags tag
      GROUP BY tag.code
      ORDER BY "modelCount" DESC, label ASC
    `);
    res.json({ items: result.rows });
  } catch (error) {
    next(error);
  }
});

const countryNames = {
  AE: 'United Arab Emirates', AR: 'Argentina', AU: 'Australia', BE: 'Belgium', BR: 'Brazil', CA: 'Canada',
  CH: 'Switzerland', CN: 'China', CO: 'Colombia', CU: 'Cuba', CZ: 'Czechia', DE: 'Germany', DO: 'Dominican Republic',
  DZ: 'Algeria', EE: 'Estonia', ES: 'Spain', FI: 'Finland', FR: 'France', GB: 'United Kingdom', GR: 'Greece',
  IL: 'Israel', IN: 'India', IR: 'Iran', IT: 'Italy', JP: 'Japan', KR: 'South Korea', LB: 'Lebanon', LU: 'Luxembourg',
  MA: 'Morocco', MX: 'Mexico', MY: 'Malaysia', NL: 'Netherlands', NZ: 'New Zealand', PH: 'Philippines', PL: 'Poland',
  PR: 'Puerto Rico', PT: 'Portugal', RO: 'Romania', RU: 'Russia', SE: 'Sweden', SG: 'Singapore', TH: 'Thailand',
  TR: 'Türkiye', TW: 'Taiwan', UA: 'Ukraine', US: 'United States', VE: 'Venezuela', VN: 'Vietnam', ZA: 'South Africa',
};

app.get('/api/model-filters', async (_req, res, next) => {
  const cacheKey = 'dream:model-filters:v1';
  const cached = await getCachedJson(cacheKey);
  if (cached) return res.json(cached);
  try {
    const [countries, bodies, chests, tags] = await Promise.all([
      pool.query(`SELECT token AS code, COUNT(*)::int AS count
        FROM models, regexp_split_to_table(summary_display, ' · ') AS token
        WHERE token ~ '^[A-Z]{2}$'
        GROUP BY token ORDER BY count DESC, token ASC`),
      pool.query(`SELECT profile_meta->>'body' AS value, COUNT(*)::int AS count
        FROM models WHERE NULLIF(profile_meta->>'body', '') IS NOT NULL
        GROUP BY value ORDER BY count DESC, value ASC`),
      pool.query(`SELECT profile_meta->>'chest' AS value FROM models
        WHERE NULLIF(profile_meta->>'chest', '') IS NOT NULL`),
      pool.query(`SELECT tag.code, MIN(tag.label) AS label, COUNT(DISTINCT tag.model_id)::int AS count
        FROM model_tags tag GROUP BY tag.code ORDER BY count DESC, label ASC LIMIT 80`),
    ]);
    const cupCounts = new Map();
    for (const row of chests.rows) {
      const match = row.value.match(/(?:^|[0-9])([A-Z]{1,3})(?:\s|\(|$)/i);
      if (match) cupCounts.set(match[1].toUpperCase(), (cupCounts.get(match[1].toUpperCase()) || 0) + 1);
    }
    const payload = {
      countries: countries.rows.map(row => ({ value: row.code.toLowerCase(), label: countryNames[row.code] || row.code, count: row.count })),
      bodyTypes: bodies.rows.map(row => ({ value: row.value, label: row.value, count: row.count })),
      cupSizes: [...cupCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([value, count]) => ({ value, label: value, count })),
      tags: tags.rows.map(row => ({ value: row.code, label: row.label, count: row.count })),
    };
    await setCachedJson(cacheKey, payload, 300);
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

app.get('/api/models/:slug', async (req, res, next) => {
  const page = parseOrRespond(paginationQuery, req.query, res);
  if (!page) return;
  const cacheKey = requestCacheKey(`model:v2:${req.params.slug}`, page);
  const cached = await getCachedJson(cacheKey);
  if (cached) return res.json(cached);
  try {
    const modelResult = await pool.query(`SELECT ${cardFields}, m.bio, m.profile_meta AS "profileMeta", m.social_links AS "socialLinks", m.source_model_url AS "sourceModelUrl", m.source_complete AS "isComplete" FROM models m ${cardJoins} WHERE m.slug = $1`, [req.params.slug]);
    const model = modelResult.rows[0];
    if (!model) return res.status(404).json({ error: 'Model not found' });
    const [tags, openLinks] = await Promise.all([
      pool.query('SELECT code, label, source_url AS "sourceUrl" FROM model_tags WHERE model_id = $1 ORDER BY label ASC', [model.id]),
      pool.query(`
        SELECT relation.position, item.content_id AS "contentId", item.short_code AS "shortCode", item.title,
          item.created_at AS "createdAt", item.relative_age AS "relativeAge", item.is_trending AS "isTrending",
          item.is_premium AS "isPremium", item.media_type AS "mediaType", item.image_url AS "imageUrl",
          item.size_bytes AS "sizeBytes", item.size_display AS "sizeDisplay", item.image_count AS images,
          item.video_count AS videos, item.status
        FROM model_open_links relation
        JOIN media_items item ON item.content_id = relation.content_id
        WHERE relation.model_id = $1 AND item.mega_url IS NOT NULL AND item.status = 'resolved'
        ORDER BY relation.position ASC
        LIMIT $2 OFFSET $3
      `, [model.id, page.limit, page.offset]),
    ]);
    const payload = { ...model, tags: tags.rows, openLinks: openLinks.rows, openLinksLimit: page.limit, openLinksOffset: page.offset };
    await setCachedJson(cacheKey, payload, 45);
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});
