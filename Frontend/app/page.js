import HomeClient from './HomeClient';
import { fetchBackendJson } from './lib/backend';

export const revalidate = 30;

export default async function HomePage({ searchParams }) {
  const params = await searchParams;
  const initialData = await fetchBackendJson('/api/open-links', {
    searchParams: { sort: params?.sort || 'newest', limit: 24, offset: 0, query: params?.q || params?.query, ethnicity: params?.ethnicity },
    revalidate: 30,
  });
  return <HomeClient initialData={initialData || { items: [], total: 0 }} />;
}
