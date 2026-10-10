import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { config } from '../src/config.js';
import { closePool, pool } from '../src/db.js';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '../..');
const sourceDirectory = process.env.MODEL_DATA_DIR || config.MODEL_DATA_DIR || path.resolve(projectRoot, '../model_json');
const frontendFiles = [
  process.env.CONTENT_JSON_PATH || path.join(projectRoot, 'Frontend/content.json'),
  process.env.PROFILES_JSON_PATH || path.join(projectRoot, 'Frontend/profiles.json'),
];
const sourceHost = 's4.imgcrate.com';
const bucket = process.env.ASSET_BUCKET || 'dreamproject-profile-images';
const region = process.env.ASSET_REGION || 'us-east-1';
const publicBaseUrl = (process.env.ASSET_PUBLIC_BASE_URL || 'https://dzromswftdto7.cloudfront.net').replace(/\/+$/, '');
const keyPrefix = (process.env.ASSET_KEY_PREFIX || 'imgcrate').replace(/^\/+|\/+$/g, '');
const concurrency = Math.max(1, Number(process.env.IMAGE_MIGRATION_CONCURRENCY || 8));
const includeFrontendFiles = process.env.MIGRATE_FRONTEND_IMAGE_URLS !== 'false';
const includeDatabaseSourceUrls = process.env.MIGRATE_DATABASE_IMAGE_URLS !== 'false';
const s3 = new S3Client({ region });
const unavailableKey = `${keyPrefix}/unavailable.svg`;
const unavailableUrl = `${publicBaseUrl}/${unavailableKey}`;
const unavailableImage = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="900" viewBox="0 0 720 900"><rect width="720" height="900" fill="#171312"/><path d="M258 390h204v120H258z" fill="#332a27"/><circle cx="330" cy="430" r="22" fill="#dd493d"/><path d="m276 486 62-56 45 40 34-31 27 47z" fill="#665550"/><text x="360" y="570" fill="#a99d99" font-family="Arial, sans-serif" font-size="26" text-anchor="middle">Image unavailable</text></svg>`;

function canonicalSource(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.hostname !== sourceHost) return null;
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

function objectKey(canonicalUrl) {
  const extension = path.extname(new URL(canonicalUrl).pathname).toLowerCase();
  const safeExtension = /^\.(avif|gif|jpe?g|png|webp)$/.test(extension) ? extension : '.webp';
  const digest = crypto.createHash('sha256').update(canonicalUrl).digest('hex');
  return `${keyPrefix}/${digest}${safeExtension}`;
}

function publicUrl(canonicalUrl) {
  return `${publicBaseUrl}/${objectKey(canonicalUrl)}`;
}

function collectSourceUrls(value, destinations) {
  if (typeof value === 'string') {
    const canonical = canonicalSource(value);
    if (canonical) {
      const candidates = destinations.get(canonical) || new Set();
      candidates.add(value);
      destinations.set(canonical, candidates);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectSourceUrls(entry, destinations));
    return;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach((entry) => collectSourceUrls(entry, destinations));
  }
}

function replaceSourceUrls(value, migrated) {
  if (typeof value === 'string') {
    const canonical = canonicalSource(value);
    return canonical && migrated.has(canonical) ? migrated.get(canonical) : value;
  }
  if (Array.isArray(value)) return value.map((entry) => replaceSourceUrls(entry, migrated));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, replaceSourceUrls(entry, migrated)]));
  }
  return value;
}

async function jsonFiles() {
  const entries = await fs.readdir(sourceDirectory, { withFileTypes: true });
  const candidates = entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(sourceDirectory, entry.name))
    .sort();
  const files = await Promise.all(candidates.map(async (file) => {
    try {
      JSON.parse(await fs.readFile(file, 'utf8'));
      return file;
    } catch {
      return null;
    }
  }));
  return files.filter(Boolean);
}

async function readJson(file) {
  return { file, data: JSON.parse(await fs.readFile(file, 'utf8')) };
}

async function databaseImageUrls() {
  const result = await pool.query(`
    SELECT profile_image_url AS image_url FROM models WHERE profile_image_url LIKE $1
    UNION
    SELECT image_url FROM media_items WHERE image_url LIKE $1
  `, [`%${sourceHost}%`]);
  return result.rows.map((row) => row.image_url);
}

async function objectExists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NotFound') return false;
    throw error;
  }
}

async function ensureUnavailableImage() {
  if (await objectExists(unavailableKey)) return;
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: unavailableKey,
    Body: Buffer.from(unavailableImage),
    ContentType: 'image/svg+xml',
    CacheControl: 'public, max-age=31536000, immutable',
  }));
}

async function fetchAndUpload(canonical, candidates) {
  const key = objectKey(canonical);
  if (await objectExists(key)) return { uploaded: false, key, targetUrl: publicUrl(canonical), unavailable: false };

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let allCandidatesMissing = true;
    for (const candidate of candidates) {
      try {
        const response = await fetch(candidate, { signal: AbortSignal.timeout(60_000) });
        if (response.status === 404 || response.status === 410) continue;
        allCandidatesMissing = false;
        if (!response.ok || !response.body) throw new Error(`source returned HTTP ${response.status}`);
        const contentType = response.headers.get('content-type')?.split(';')[0] || 'application/octet-stream';
        // Buffering avoids the AWS SDK's chunked-stream checksum path, which is
        // incompatible with Node 24 when the upstream response has no length.
        // Concurrency is deliberately capped so this remains memory-bounded.
        const body = Buffer.from(await response.arrayBuffer());
        await s3.send(new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        }));
        return { uploaded: true, key, targetUrl: publicUrl(canonical), unavailable: false };
      } catch (error) {
        lastError = error;
        allCandidatesMissing = false;
      }
    }
    if (allCandidatesMissing) return { uploaded: false, key: unavailableKey, targetUrl: unavailableUrl, unavailable: true };
    await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
  }
  throw lastError || new Error('No source candidates were available');
}

async function migrateObjects(sources) {
  const entries = [...sources.entries()];
  const migrated = new Map();
  let cursor = 0;
  let uploaded = 0;
  let skipped = 0;
  let unavailable = 0;
  const workers = Array.from({ length: Math.min(concurrency, entries.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= entries.length) return;
      const [canonical, candidates] = entries[index];
      const result = await fetchAndUpload(canonical, candidates);
      migrated.set(canonical, result.targetUrl);
      if (result.uploaded) uploaded += 1;
      else skipped += 1;
      if (result.unavailable) unavailable += 1;
      if ((index + 1) % 50 === 0 || index + 1 === entries.length) {
        console.log(JSON.stringify({ phase: 'uploading', completed: index + 1, total: entries.length, uploaded, alreadyPresent: skipped, unavailable }));
      }
    }
  });
  await Promise.all(workers);
  return { migrated, uploaded, skipped, unavailable };
}

async function writeJsonFiles(records, migrated) {
  for (const { file, data } of records) {
    const updated = replaceSourceUrls(data, migrated);
    const temporaryFile = `${file}.${process.pid}.tmp`;
    await fs.writeFile(temporaryFile, `${JSON.stringify(updated, null, 2)}\n`);
    await fs.rename(temporaryFile, file);
  }
}

async function updateDatabase(migrated) {
  const mappings = [...migrated.entries()].map(([canonicalUrl, targetUrl]) => ({
    canonical_url: canonicalUrl,
    target_url: targetUrl,
  }));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('CREATE TEMP TABLE asset_url_migrations (canonical_url TEXT PRIMARY KEY, target_url TEXT NOT NULL) ON COMMIT DROP');
    await client.query(`
      INSERT INTO asset_url_migrations (canonical_url, target_url)
      SELECT canonical_url, target_url
      FROM jsonb_to_recordset($1::jsonb) AS mapping(canonical_url TEXT, target_url TEXT)
    `, [JSON.stringify(mappings)]);
    const models = await client.query(`
      UPDATE models AS model
      SET profile_image_url = migration.target_url, updated_at = NOW()
      FROM asset_url_migrations AS migration
      WHERE split_part(model.profile_image_url, '?', 1) = migration.canonical_url
    `);
    const media = await client.query(`
      UPDATE media_items AS media
      SET image_url = migration.target_url, updated_at = NOW()
      FROM asset_url_migrations AS migration
      WHERE split_part(media.image_url, '?', 1) = migration.canonical_url
    `);
    await client.query('COMMIT');
    return { models: models.rowCount, media: media.rowCount };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const modelFiles = await jsonFiles();
  const records = await Promise.all([...modelFiles, ...(includeFrontendFiles ? frontendFiles : [])].map(readJson));
  const sources = new Map();
  records.forEach(({ data }) => collectSourceUrls(data, sources));
  const databaseUrls = includeDatabaseSourceUrls ? await databaseImageUrls() : [];
  databaseUrls.forEach((url) => collectSourceUrls(url, sources));
  const summary = {
    sourceDirectory,
    modelFiles: modelFiles.length,
    frontendFiles: includeFrontendFiles ? frontendFiles.map((file) => path.relative(projectRoot, file)) : [],
    databaseSourceUrls: databaseUrls.length,
    includeDatabaseSourceUrls,
    uniqueSourceImages: sources.size,
    bucket,
    publicBaseUrl,
    dryRun,
  };
  if (dryRun) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  await ensureUnavailableImage();
  const { migrated, uploaded, skipped, unavailable } = await migrateObjects(sources);
  await writeJsonFiles(records, migrated);
  const database = includeDatabaseSourceUrls
    ? await updateDatabase(migrated)
    : { skipped: true, models: 0, media: 0 };
  console.log(JSON.stringify({ ...summary, uploaded, alreadyPresent: skipped, unavailable, database, status: 'complete' }, null, 2));
}

try {
  await main();
} finally {
  await closePool();
}
