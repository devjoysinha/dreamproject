import ConversationClient from './ConversationClient';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const name = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return {
    title: `Chat with ${name} – LeakPorns`,
    description: `Have a private conversation with ${name}.`,
  };
}

export default async function ChatConversationPage({ params }) {
  const { slug } = await params;
  return <ConversationClient slug={slug} />;
}
