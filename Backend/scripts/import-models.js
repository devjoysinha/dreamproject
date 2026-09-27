import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../src/config.js';
import { closePool, pool } from '../src/db.js';
import { slugify, stableId } from '../src/slug.js';

const args = new Set(process.argv.slice(2));
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultDirectory = path.resolve(currentDirectory, '../../../model_json');
const sourceDirectory = process.env.MODEL_DATA_DIR || config.MODEL_DATA_DIR || defaultDirectory;
const dryRun = args.has('--dry-run');

function timestamp(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

function modelSlug(document, existing) {
  const root = slugify(document.profile.name);
  return existing.has(root) ? `${root}-${stableId('src', document.source.model_url).slice(-6)}` : root;
}

function mediaPayload(link) {
  return {
    position: link.position,
    content_id: link.content_id,
    short_code: link.short_code,
    title: link.title,
    created_at: timestamp(link.created_at),
    relative_age: link.relative_age,
    is_trending: Boolean(link.is_trending),
    is_premium: Boolean(link.is_premium),
    media_type: link.media_type,
    image_url: link.image_url,
    size_bytes: link.size?.bytes || null,
    size_display: link.size?.display || null,
    image_count: link.images || 0,
    video_count: link.videos || 0,
    mega_url: link.mega_url,
    status: link.status,
  };
}

async function readDocuments() {
  const entries = await fs.readdir(sourceDirectory, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json')).map((entry) => entry.name).sort();
  const slugs = new Set();
  const documents = [];
  for (const file of files) {
    const document = JSON.parse(await fs.readFile(path.join(sourceDirectory, file), 'utf8'));
    const slug = modelSlug(document, slugs);
    slugs.add(slug);
    documents.push({ file, slug, document });
  }
  return documents;
}

async function importModels() {
  const documents = await readDocuments();
  const mediaCount = documents.reduce((total, entry) => total + entry.document.open_links.length, 0);
  if (dryRun) {
    console.log(JSON.stringify({ sourceDirectory, models: documents.length, openLinks: mediaCount, dryRun: true }, null, 2));
    return;
  }

  const runId = stableId('run', `${sourceDirectory}:${Date.now()}`);
  await pool.query('INSERT INTO ingest_runs (id, source_directory, status) VALUES ($1, $2, $3)', [runId, sourceDirectory, 'running']);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const { slug, document } of documents) {
      const modelId = stableId('mdl', document.source.model_url);
      const { profile, source, counts } = document;
      await client.query(`
        INSERT INTO models (id, slug, name, bio, profile_image_url, summary_display, profile_meta, social_links, source_model_url, source_query, source_retrieved_at, source_schema_version, source_complete, source_updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (source_model_url) DO UPDATE SET
          slug = EXCLUDED.slug, name = EXCLUDED.name, bio = EXCLUDED.bio, profile_image_url = EXCLUDED.profile_image_url,
          summary_display = EXCLUDED.summary_display, profile_meta = EXCLUDED.profile_meta, social_links = EXCLUDED.social_links,
          source_query = EXCLUDED.source_query, source_retrieved_at = EXCLUDED.source_retrieved_at,
          source_schema_version = EXCLUDED.source_schema_version, source_complete = EXCLUDED.source_complete,
          source_updated_at = EXCLUDED.source_updated_at, updated_at = NOW()
      `, [modelId, slug, profile.name, profile.bio, profile.profile_image_url, profile.summary_display, JSON.stringify(profile.meta || {}), JSON.stringify(profile.social_links || {}), source.model_url, source.model_query, timestamp(source.retrieved_at), document.schema_version, document.complete, timestamp(document.updated_at)]);
      await client.query('DELETE FROM model_tags WHERE model_id = $1', [modelId]);
      await client.query('DELETE FROM model_open_links WHERE model_id = $1', [modelId]);
      if (profile.tags?.length) {
        await client.query(`
          INSERT INTO model_tags (model_id, code, label, source_url)
          SELECT $1, code, label, source_url
          FROM jsonb_to_recordset($2::jsonb) AS tags(code TEXT, label TEXT, source_url TEXT)
        `, [modelId, JSON.stringify(profile.tags.map((tag) => ({ code: tag.code, label: tag.label, source_url: tag.url })))]);
      }
      if (document.open_links.length) {
        await client.query(`
          WITH links AS (
            SELECT * FROM jsonb_to_recordset($2::jsonb) AS link(
              position INTEGER,
              content_id TEXT,
              short_code TEXT,
              title TEXT,
              created_at TIMESTAMPTZ,
              relative_age TEXT,
              is_trending BOOLEAN,
              is_premium BOOLEAN,
              media_type TEXT,
              image_url TEXT,
              size_bytes BIGINT,
              size_display TEXT,
              image_count INTEGER,
              video_count INTEGER,
              mega_url TEXT,
              status TEXT
            )
          ),
          upserted AS (
            INSERT INTO media_items (
              content_id, short_code, title, created_at, relative_age, is_trending, is_premium,
              media_type, image_url, size_bytes, size_display, image_count, video_count, mega_url, status
            )
            SELECT
              content_id, short_code, title, created_at, relative_age, is_trending, is_premium,
              media_type, image_url, size_bytes, size_display, image_count, video_count, mega_url, status
            FROM links
            ON CONFLICT (content_id) DO UPDATE SET
              short_code = EXCLUDED.short_code, title = EXCLUDED.title, created_at = EXCLUDED.created_at,
              relative_age = EXCLUDED.relative_age, is_trending = EXCLUDED.is_trending, is_premium = EXCLUDED.is_premium,
              media_type = EXCLUDED.media_type, image_url = EXCLUDED.image_url, size_bytes = EXCLUDED.size_bytes,
              size_display = EXCLUDED.size_display, image_count = EXCLUDED.image_count, video_count = EXCLUDED.video_count,
              mega_url = EXCLUDED.mega_url, status = EXCLUDED.status, updated_at = NOW()
          )
          INSERT INTO model_open_links (model_id, content_id, position)
          SELECT $1, content_id, position FROM links
        `, [modelId, JSON.stringify(document.open_links.map(mediaPayload))]);
      }
    }
    await client.query('COMMIT');
    await pool.query('UPDATE ingest_runs SET models_seen = $2, media_records_seen = $3, completed_at = NOW(), status = $4 WHERE id = $1', [runId, documents.length, mediaCount, 'completed']);
    console.log(JSON.stringify({ runId, models: documents.length, openLinks: mediaCount, sourceDirectory }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    await pool.query('UPDATE ingest_runs SET completed_at = NOW(), status = $2, error_message = $3 WHERE id = $1', [runId, 'failed', error.message]);
    throw error;
  } finally {
    client.release();
  }
}

try {
  await importModels();
} finally {
  await closePool();
}
