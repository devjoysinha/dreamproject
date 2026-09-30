import ModelClient from './ModelClient';
import { fetchBackendJson } from '../../lib/backend';

export const revalidate = 30;

function profileSlug(value = '') {
  return decodeURIComponent(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default async function ModelPage({ params }) {
  const { slug } = await params;
  const initialModel = await fetchBackendJson(`/api/models/${encodeURIComponent(profileSlug(slug))}`, { searchParams: { limit: 24 }, revalidate: 30 });
  return <ModelClient initialModel={initialModel} />;
}
