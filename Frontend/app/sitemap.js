const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://leakporns.com';
const backendOrigin = process.env.BACKEND_ORIGIN || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const pageSize = 60;

async function getAvailableModels() {
  const models = [];
  let offset = 0;

  try {
    while (true) {
      const endpoint = new URL('/api/models', backendOrigin);
      endpoint.searchParams.set('sort', 'name');
      endpoint.searchParams.set('limit', String(pageSize));
      endpoint.searchParams.set('offset', String(offset));
      const response = await fetch(endpoint, { headers: internalApiHeaders(), next: { revalidate: 3600 } });
      if (!response.ok) break;

      const data = await response.json();
      const items = Array.isArray(data.items) ? data.items : [];
      models.push(...items.filter(model => model.slug && Number(model.openLinkCount) > 0));
      offset += items.length;

      if (!items.length || offset >= Number(data.total || 0) || items.length < pageSize) break;
    }
  } catch {
    // The sitemap still serves the public catalogue URLs when the API is temporarily unavailable.
  }

  return models;
}

export const dynamic = 'force-dynamic';

export default async function sitemap() {
  const models = await getAvailableModels();
  const staticRoutes = [
    { url: siteUrl, changeFrequency: 'daily', priority: 1 },
    { url: `${siteUrl}/models`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${siteUrl}/creators`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${siteUrl}/upgrade`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${siteUrl}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${siteUrl}/terms`, changeFrequency: 'yearly', priority: 0.2 },
  ];

  return [
    ...staticRoutes,
    ...models.map(model => ({
      url: `${siteUrl}/model/${encodeURIComponent(model.slug)}`,
      lastModified: model.updatedAt || undefined,
      changeFrequency: 'daily',
      priority: 0.8,
    })),
  ];
}
import { internalApiHeaders } from './lib/backend';
