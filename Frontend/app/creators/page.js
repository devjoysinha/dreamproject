import { DiscoverDashboard } from '../components/DreamDashboard';
import { fetchBackendJson } from '../lib/backend';
import { publicMetadata } from '../lib/seo';

export const revalidate = 30;
export const dynamic = 'force-dynamic';
export const metadata = publicMetadata({
  title: 'Explore OnlyFans Creators',
  description: 'Explore creator profiles with available OnlyFans, Fansly, and premium media links.',
  path: '/creators',
});

export default async function CreatorsPage() {
  const initialData = await fetchBackendJson('/api/models', { searchParams: { sort: 'name', limit: 30, offset: 0 }, revalidate: 30 });
  return <DiscoverDashboard initialData={initialData || { items: [], total: 0 }} page="creators" />;
}
