import { DiscoverDashboard } from '../components/DreamDashboard';
import { fetchBackendJson } from '../lib/backend';

export const revalidate = 30;
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dreamproject Discover', description: 'Explore trending creators and collections.' };

export default async function DiscoverPage() {
  const initialData = await fetchBackendJson('/api/models', { searchParams: { sort: 'hot', limit: 30, offset: 0 }, revalidate: 30 });
  return <DiscoverDashboard initialData={initialData || { items: [], total: 0 }} page="discover" />;
}
