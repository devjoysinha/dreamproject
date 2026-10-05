import ModelsClient from './ModelsClient';
import { fetchBackendJson } from '../lib/backend';
import { publicMetadata } from '../lib/seo';

export const revalidate = 30;

// Filter combinations are useful to visitors, but are not distinct catalogue pages
// for search engines. Keep their canonical URL on the unfiltered directory.
export async function generateMetadata({ searchParams }) {
  const params = await searchParams;
  if (!Object.keys(params || {}).length) return {};
  return publicMetadata({
    title: 'Browse All Models - OnlyFans Leaks',
    description: 'Browse OnlyFans, Fansly, and premium creator profiles with available photos, videos, and open links.',
    path: '/models',
    robots: { index: false, follow: true },
  });
}

export default async function ModelsPage({ searchParams }) {
  const params = await searchParams;
  const [initialData, initialFilterOptions] = await Promise.all([
    fetchBackendJson('/api/models', {
      searchParams: {
        sort: params?.sort || 'hot', limit: 30, offset: 0, query: params?.query,
        ethnicity: params?.ethnicity, country: params?.country, tag: params?.tag,
        bodyType: params?.bodyType, cupSize: params?.cupSize,
      },
      revalidate: 30,
    }),
    fetchBackendJson('/api/model-filters', { revalidate: 300 }),
  ]);
  return <ModelsClient initialData={initialData || { items: [], total: 0 }} initialFilterOptions={initialFilterOptions || {}} />;
}
