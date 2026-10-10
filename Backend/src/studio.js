import crypto from 'node:crypto';
import { config } from './config.js';
import { pool } from './db.js';

export async function getPresets(category) {
  const filters = ['is_active = TRUE'];
  const values = [];
  if (category && category !== 'all') {
    values.push(category);
    filters.push(`category = $${values.length}`);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT id, slug, name, description, thumbnail_url AS "thumbnailUrl", category, credit_cost AS "creditCost"
     FROM studio_presets ${where}
     ORDER BY sort_order ASC, created_at DESC`,
    values,
  );
  return rows;
}

export async function getPresetBySlug(slug) {
  const { rows } = await pool.query(
    `SELECT id, slug, name, description, thumbnail_url AS "thumbnailUrl", category,
            style_prompt AS "stylePrompt", negative_prompt AS "negativePrompt", credit_cost AS "creditCost"
     FROM studio_presets WHERE slug = $1 AND is_active = TRUE`,
    [slug],
  );
  return rows[0] || null;
}

export async function getGenerations(sessionId, limit = 20) {
  const { rows } = await pool.query(
    `SELECT g.id, g.prompt, g.image_url AS "imageUrl", g.width, g.height, g.created_at AS "createdAt",
            p.name AS "presetName", p.slug AS "presetSlug"
     FROM studio_generations g
     JOIN studio_presets p ON p.id = g.preset_id
     WHERE g.session_id = $1
     ORDER BY g.created_at DESC
     LIMIT $2`,
    [sessionId, limit],
  );
  return rows;
}

async function saveGeneration(presetId, sessionId, prompt, imageUrl, width, height) {
  const { rows } = await pool.query(
    `INSERT INTO studio_generations (preset_id, session_id, prompt, image_url, width, height)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at AS "createdAt"`,
    [presetId, sessionId, prompt, imageUrl, width, height],
  );
  return rows[0];
}

function buildFullPrompt(preset, userPrompt) {
  return `${preset.stylePrompt}, ${userPrompt}`.trim();
}

function generateWithPollinations(prompt, _negativePrompt, width, height) {
  const seed = crypto.randomInt(1, 999999);
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    seed: String(seed),
  });
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params}`;
}

export async function generateImage(preset, sessionId, userPrompt, width = 512, height = 512) {
  const fullPrompt = buildFullPrompt(preset, userPrompt);
  const negativePrompt = preset.negativePrompt || '';

  let imageUrl;
  if (config.STUDIO_IMAGE_PROVIDER === 'pollinations') {
    imageUrl = generateWithPollinations(fullPrompt, negativePrompt, width, height);
  } else {
    throw new Error(`Unknown image provider: ${config.STUDIO_IMAGE_PROVIDER}`);
  }

  const record = await saveGeneration(preset.id, sessionId, userPrompt, imageUrl, width, height);
  return { id: record.id, imageUrl, width, height, createdAt: record.createdAt };
}
