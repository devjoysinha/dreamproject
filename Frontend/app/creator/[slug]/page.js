import { CreatorProfileDashboard } from '../../components/CreatorProfileDashboard';
import { fetchBackendJson } from '../../lib/backend';
import { publicMetadata } from '../../lib/seo';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

function normalizeSlug(value = '') {
  try { return decodeURIComponent(value).trim().toLowerCase().replace(/\s+/g, '-'); } catch { return value.trim().toLowerCase().replace(/\s+/g, '-'); }
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const normalizedSlug = normalizeSlug(slug);
  const model = await fetchBackendJson(`/api/models/${encodeURIComponent(normalizedSlug)}`, { searchParams: { limit: 60 }, revalidate: 30 });
  const name = model?.name || 'Creator profile';
  const canonicalSlug = model?.slug || normalizedSlug;
  const description = model?.summaryDisplay || `Explore ${name}'s available OnlyFans photos, videos, and open links.`;
  const metadata = publicMetadata({
    title: `${name} profile`,
    description,
    path: `/model/${encodeURIComponent(canonicalSlug)}`,
    robots: { index: false, follow: true },
  });
  if (model?.profileImageUrl) {
    metadata.openGraph.images = [{ url: model.profileImageUrl, width: 800, height: 600, alt: `${name} profile` }];
    metadata.twitter.images = [model.profileImageUrl];
  }
  return metadata;
}

export default async function CreatorProfilePage({ params }) {
  const { slug: rawSlug } = await params;
  const slug = normalizeSlug(rawSlug);
  const model = await fetchBackendJson(`/api/models/${encodeURIComponent(slug)}`, { searchParams: { limit: 60 }, revalidate: 30 });
  return <CreatorProfileDashboard slug={slug} initialModel={model} />;
}
