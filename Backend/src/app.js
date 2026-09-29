import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import { config } from './config.js';
import { pool } from './db.js';

const listQuery = z.object({
  query: z.string().trim().max(120).optional(),
  tag: z.string().trim().max(160).optional(),
  sort: z.enum(['newest', 'name', 'links']).default('newest'),
  limit: z.coerce.number().int().min(1).max(60).default(30),
  offset: z.coerce.number().int().min(0).default(0),
});
const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(60).default(24),
  offset: z.coerce.number().int().min(0).default(0),
});
const openLinksQuery = z.object({
  query: z.string().trim().max(120).optional(),
  sort: z.enum(['newest', 'trending', 'name']).default('newest'),
  limit: z.coerce.number().int().min(1).max(60).default(24),
  offset: z.coerce.number().int().min(0).default(0),
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
  }[sort];
}

function openLinksOrdering(sort) {
  return {
    newest: 'item.created_at DESC NULLS LAST, item.title ASC',
    trending: 'item.is_trending DESC, item.created_at DESC NULLS LAST, item.title ASC',
    name: 'm.name ASC, item.created_at DESC NULLS LAST',
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

export const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: config.FRONTEND_ORIGIN, methods: ['GET'] }));
app.use(express.json({ limit: '100kb' }));

app.get('/health', async (_req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
});

app.get('/api/open-links', async (req, res, next) => {
  const query = parseOrRespond(openLinksQuery, req.query, res);
  if (!query) return;
  const filters = [];
  const values = [];
  if (query.query) {
    values.push(`%${query.query}%`);
    filters.push(`(item.title ILIKE $${values.length} OR m.name ILIKE $${values.length} OR m.source_query ILIKE $${values.length})`);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  values.push(query.limit, query.offset);
  const from = 'FROM media_items item JOIN model_open_links relation ON relation.content_id = item.content_id JOIN models m ON m.id = relation.model_id';
  const sql = `SELECT item.content_id AS id, item.short_code AS "shortCode", item.title, item.image_url AS "imageUrl", item.image_count AS images, item.video_count AS videos, item.size_bytes AS "sizeBytes", item.size_display AS "sizeDisplay", item.created_at AS "createdAt", item.relative_age AS "relativeAge", item.is_trending AS "isTrending", item.is_premium AS "isPremium", item.mega_url AS "megaUrl", item.status, m.slug AS "modelSlug", m.name AS "modelName" ${from} ${where} ORDER BY ${openLinksOrdering(query.sort)} LIMIT $${values.length - 1} OFFSET $${values.length}`;
  const totalSql = `SELECT COUNT(*)::int AS total ${from} ${where}`;
  try {
    const [items, total] = await Promise.all([
      pool.query(sql, values),
      pool.query(totalSql, values.slice(0, -2)),
    ]);
    res.json({ items: items.rows, total: total.rows[0].total, limit: query.limit, offset: query.offset });
  } catch (error) {
    next(error);
  }
});

app.get('/api/models', async (req, res, next) => {
  const query = parseOrRespond(listQuery, req.query, res);
  if (!query) return;
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
    res.json({ items: items.rows, total: total.rows[0].total, limit: query.limit, offset: query.offset });
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

app.get('/api/models/:slug', async (req, res, next) => {
  const page = parseOrRespond(paginationQuery, req.query, res);
  if (!page) return;
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
          item.video_count AS videos, item.mega_url AS "megaUrl", item.status
        FROM model_open_links relation
        JOIN media_items item ON item.content_id = relation.content_id
        WHERE relation.model_id = $1
        ORDER BY relation.position ASC
        LIMIT $2 OFFSET $3
      `, [model.id, page.limit, page.offset]),
    ]);
    res.json({ ...model, tags: tags.rows, openLinks: openLinks.rows, openLinksLimit: page.limit, openLinksOffset: page.offset });
  } catch (error) {
    next(error);
  }
});

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});
