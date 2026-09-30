import { DiscoverLinksDashboard } from './components/DiscoverLinksDashboard';
import { fetchBackendJson } from './lib/backend';

export const revalidate = 30;
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'LeakPorns — Discover',
  description: 'Browse the newest available open links from creators.',
};

export default async function HomePage() {
  const initialData = await fetchBackendJson('/api/open-links', {
    searchParams: { sort: 'newest', limit: 30, offset: 0 },
    revalidate: 30,
  });
  return <DiscoverLinksDashboard initialData={initialData || { items: [], total: 0 }} />;
}
