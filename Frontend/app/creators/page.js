import { DiscoverDashboard } from '../components/DreamDashboard';
import { fetchBackendJson } from '../lib/backend';

export const revalidate = 30;
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Explore Creators | Dreamproject', description: 'Browse creator profiles with available links.' };

export default async function CreatorsPage() {
  const initialData = await fetchBackendJson('/api/models', { searchParams: { sort: 'name', limit: 30, offset: 0 }, revalidate: 30 });
  return <DiscoverDashboard initialData={initialData || { items: [], total: 0 }} page="creators" />;
}
