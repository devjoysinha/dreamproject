import ModelClient from './ModelClient';
import { fetchBackendJson } from '../../lib/backend';

export const revalidate = 30;

export default async function ModelPage({ params }) {
  const { slug } = await params;
  const initialModel = await fetchBackendJson(`/api/models/${encodeURIComponent(slug)}`, { searchParams: { limit: 24 }, revalidate: 30 });
  return <ModelClient initialModel={initialModel} />;
}
