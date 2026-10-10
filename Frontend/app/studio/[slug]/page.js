import GenerateClient from './GenerateClient';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const name = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return {
    title: `${name} – AI Studio – LeakPorns`,
    description: `Generate AI images using the ${name} style preset.`,
  };
}

export default async function StudioGeneratePage({ params }) {
  const { slug } = await params;
  return <GenerateClient slug={slug} />;
}
