import { DiscoverLinksDashboard } from '../components/DiscoverLinksDashboard';
import { fetchBackendJson } from '../lib/backend';
import { publicMetadata } from '../lib/seo';

export const revalidate = 30;
export const dynamic = 'force-dynamic';
export const metadata = publicMetadata({
  title: 'Discover OnlyFans Leaks & Photos',
  description: 'Browse the newest OnlyFans, Fansly, and premium creator links on Leakporns.',
  path: '/',
  robots: { index: false, follow: true },
});

export default async function DiscoverPage() {
  const initialData = await fetchBackendJson('/api/open-links', { searchParams: { sort: 'newest', limit: 30, offset: 0 }, revalidate: 30 });
  return <DiscoverLinksDashboard initialData={initialData || { items: [], total: 0 }} />;
}
