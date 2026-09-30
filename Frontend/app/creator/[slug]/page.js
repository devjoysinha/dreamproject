import { CreatorProfileDashboard } from '../../components/CreatorProfileDashboard';
import { fetchBackendJson } from '../../lib/backend';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

function normalizeSlug(value = '') {
  try { return decodeURIComponent(value).trim().toLowerCase().replace(/\s+/g, '-'); } catch { return value.trim().toLowerCase().replace(/\s+/g, '-'); }
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const model = await fetchBackendJson(`/api/models/${encodeURIComponent(normalizeSlug(slug))}`, { searchParams: { limit: 60 }, revalidate: 30 });
  const name = model?.name || 'Creator profile';
  return { title: `${name} | Dreamproject`, description: model?.summaryDisplay || `Explore ${name}'s available collections.` };
}

export default async function CreatorProfilePage({ params }) {
  const { slug: rawSlug } = await params;
  const slug = normalizeSlug(rawSlug);
  const model = await fetchBackendJson(`/api/models/${encodeURIComponent(slug)}`, { searchParams: { limit: 60 }, revalidate: 30 });
  return <CreatorProfileDashboard slug={slug} initialModel={model} />;
}
