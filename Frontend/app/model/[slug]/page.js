import ModelClient from './ModelClient';
import { fetchBackendJson } from '../../lib/backend';
import JsonLd from '../../components/JsonLd';
import { absoluteUrl } from '../../lib/seo';

export const revalidate = 30;

function profileSlug(value = '') {
  return decodeURIComponent(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default async function ModelPage({ params }) {
  const { slug } = await params;
  const normalizedSlug = profileSlug(slug);
  const initialModel = await fetchBackendJson(`/api/models/${encodeURIComponent(normalizedSlug)}`, { searchParams: { limit: 24 }, revalidate: 30 });
  const name = initialModel?.name || normalizedSlug;
  const description = initialModel?.bio || `Explore ${name}'s available OnlyFans photos, videos, and open links.`;
  const schema = initialModel ? {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${name} OnlyFans photos, videos, and links`,
    description,
    url: absoluteUrl(`/model/${encodeURIComponent(normalizedSlug)}`),
    ...(initialModel.profileImageUrl ? { primaryImageOfPage: initialModel.profileImageUrl } : {}),
    isPartOf: { '@type': 'WebSite', name: 'Leakporns', url: absoluteUrl('/') },
  } : null;

  return <>
    {schema ? <JsonLd data={schema} /> : null}
    <ModelClient initialModel={initialModel} />
  </>;
}
