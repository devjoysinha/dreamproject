import { DiscoverLinksDashboard } from './components/DiscoverLinksDashboard';
import { fetchBackendJson } from './lib/backend';
import JsonLd from './components/JsonLd';
import { defaultDescription, publicMetadata, siteName, siteUrl } from './lib/seo';

export const revalidate = 30;
export const dynamic = 'force-dynamic';
export const metadata = publicMetadata({
  title: 'Free OnlyFans Leaks & Photos',
  description: 'Browse the newest OnlyFans, Fansly, and premium creator photos, videos, and available links.',
  path: '/',
});

export default async function HomePage() {
  const initialData = await fetchBackendJson('/api/open-links', {
    searchParams: { sort: 'newest', limit: 30, offset: 0 },
    revalidate: 30,
  });
  return <>
    <JsonLd data={{
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: siteName,
      url: siteUrl,
      description: defaultDescription,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${siteUrl}/models?query={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    }} />
    <DiscoverLinksDashboard initialData={initialData || { items: [], total: 0 }} />
  </>;
}
