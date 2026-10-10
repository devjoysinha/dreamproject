import crypto from 'node:crypto';
import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const presets = [
  {
    slug: 'dream-image',
    name: 'Dream Image',
    description: 'Generate stunning AI images from text prompts. High quality, photorealistic results.',
    category: 'popular',
    stylePrompt: 'photorealistic, high quality, detailed, 8k resolution, professional photography',
    negativePrompt: 'blurry, low quality, distorted, watermark, text',
    creditCost: 5,
    sortOrder: 1,
  },
  {
    slug: 'anime-art',
    name: 'Anime Art',
    description: 'Beautiful anime-style artwork with vibrant colors and expressive characters.',
    category: 'popular',
    stylePrompt: 'anime style, vibrant colors, detailed illustration, beautiful lighting, studio quality anime art',
    negativePrompt: 'realistic, photographic, blurry, low quality',
    creditCost: 5,
    sortOrder: 2,
  },
  {
    slug: 'fantasy-portrait',
    name: 'Fantasy Portrait',
    description: 'Ethereal fantasy portraits with magical lighting and dreamy atmospheres.',
    category: 'image',
    stylePrompt: 'fantasy art, ethereal lighting, magical atmosphere, detailed portrait, mystical, enchanting',
    negativePrompt: 'modern, mundane, blurry, low quality',
    creditCost: 5,
    sortOrder: 3,
  },
  {
    slug: 'glamour-shot',
    name: 'Glamour Shot',
    description: 'Professional glamour photography style with perfect lighting and composition.',
    category: 'popular',
    stylePrompt: 'glamour photography, studio lighting, professional model photography, high fashion, beautiful lighting, magazine quality',
    negativePrompt: 'amateur, blurry, low quality, bad lighting',
    creditCost: 5,
    sortOrder: 4,
  },
  {
    slug: 'pin-up-art',
    name: 'Pin-Up Art',
    description: 'Classic pin-up art style inspired by vintage illustrations.',
    category: 'image',
    stylePrompt: 'vintage pin-up art style, retro illustration, classic beauty, 1950s aesthetic, warm tones, artistic',
    negativePrompt: 'photorealistic, modern, blurry',
    creditCost: 5,
    sortOrder: 5,
  },
  {
    slug: 'digital-painting',
    name: 'Digital Painting',
    description: 'Rich digital paintings with artistic brushstrokes and vivid colors.',
    category: 'image',
    stylePrompt: 'digital painting, artistic, vibrant colors, detailed brushwork, concept art quality, masterpiece',
    negativePrompt: 'photographic, blurry, low quality',
    creditCost: 5,
    sortOrder: 6,
  },
  {
    slug: 'noir-cinema',
    name: 'Noir Cinema',
    description: 'Dramatic black and white cinematic style with deep shadows and contrast.',
    category: 'new',
    stylePrompt: 'film noir style, dramatic black and white, high contrast, cinematic lighting, moody shadows, vintage cinema',
    negativePrompt: 'colorful, bright, cheerful, low quality',
    creditCost: 5,
    sortOrder: 7,
  },
  {
    slug: 'cyberpunk',
    name: 'Cyberpunk',
    description: 'Futuristic neon-lit scenes with a cyberpunk aesthetic.',
    category: 'new',
    stylePrompt: 'cyberpunk style, neon lights, futuristic, rain-slicked streets, holographic, sci-fi, high tech low life',
    negativePrompt: 'natural, rural, blurry, low quality',
    creditCost: 5,
    sortOrder: 8,
  },
  {
    slug: 'oil-painting',
    name: 'Oil Painting',
    description: 'Classical oil painting style with rich textures and renaissance influences.',
    category: 'image',
    stylePrompt: 'oil painting, classical art style, rich textures, renaissance inspired, museum quality, dramatic lighting',
    negativePrompt: 'digital, modern, photographic, blurry',
    creditCost: 5,
    sortOrder: 9,
  },
  {
    slug: 'watercolor',
    name: 'Watercolor',
    description: 'Soft watercolor illustrations with delicate washes and flowing colors.',
    category: 'new',
    stylePrompt: 'watercolor painting, soft washes, delicate colors, flowing artistic style, paper texture, beautiful illustration',
    negativePrompt: 'photorealistic, sharp, digital, blurry',
    creditCost: 5,
    sortOrder: 10,
  },
  {
    slug: 'comic-book',
    name: 'Comic Book',
    description: 'Bold comic book art with dynamic poses and vivid inking.',
    category: 'new',
    stylePrompt: 'comic book art style, bold inking, dynamic composition, vivid colors, action pose, graphic novel quality',
    negativePrompt: 'photorealistic, blurry, low quality, muted',
    creditCost: 5,
    sortOrder: 11,
  },
  {
    slug: 'lingerie-editorial',
    name: 'Lingerie Editorial',
    description: 'High-end fashion editorial style with elegant lingerie aesthetics.',
    category: 'popular',
    stylePrompt: 'high fashion editorial photography, elegant lingerie, professional studio lighting, vogue magazine style, luxurious setting',
    negativePrompt: 'amateur, low quality, blurry, harsh lighting',
    creditCost: 5,
    sortOrder: 12,
  },
];

async function seed() {
  for (const p of presets) {
    const id = crypto.randomUUID();
    await pool.query(
      `INSERT INTO studio_presets (id, slug, name, description, category, style_prompt, negative_prompt, credit_cost, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         category = EXCLUDED.category,
         style_prompt = EXCLUDED.style_prompt,
         negative_prompt = EXCLUDED.negative_prompt,
         credit_cost = EXCLUDED.credit_cost,
         sort_order = EXCLUDED.sort_order,
         updated_at = NOW()`,
      [id, p.slug, p.name, p.description, p.category, p.stylePrompt, p.negativePrompt, p.creditCost, p.sortOrder],
    );
    console.log(`  Seeded: ${p.name}`);
  }
  console.log(`Done – ${presets.length} presets seeded.`);
  await pool.end();
}

seed().catch(err => { console.error(err); process.exit(1); });
