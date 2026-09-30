import ModelsClient from './ModelsClient';
import { fetchBackendJson } from '../lib/backend';

export const revalidate = 30;

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
