import Link from 'next/link';
import MobileNav from '../components/MobileNav';

const sections = {
  studio: { label: 'Studio', description: 'Creator tools will be available here once publishing is enabled.' },
  chat: { label: 'Chat', description: 'Chat is ready for the account and messaging service to be connected.' },
  account: { label: 'Account', description: 'You are browsing as a guest. Sign-in and saved-account settings will appear here.' },
  lists: { label: 'My Lists', description: 'Saved links are available from the catalogue today. Account-backed lists are coming next.' },
  shop: { label: 'Shop', description: 'The shop is being prepared for the Leakporns catalogue.' },
  rewards: { label: 'Rewards', description: 'Rewards will appear here when account activity is enabled.' },
  'visual-search': { label: 'Visual Image Search', description: 'Upload-based visual search will be available when the image matching service is connected.' },
};

export function generateStaticParams() {
  return Object.keys(sections).map(section => ({ section }));
}

export default async function SectionPage({ params }) {
  const { section } = await params;
  const content = sections[section] || { label: 'Page', description: 'This section is not available yet.' };
  return <div className="site-shell utility-shell">
    <MobileNav active={section === 'account' ? 'account' : undefined} />
    <main className="utility-main">
      <Link className="utility-brand" href="/"><img src="/7035402.svg" alt="Leakporns logo" /><span>leak<b>porns</b></span></Link>
      <section className="utility-card"><p className="eyebrow">— Leakporns</p><h1>{content.label}</h1><p>{content.description}</p><div><Link href="/">Back to Browse</Link><Link href="/models">Browse Models</Link></div></section>
    </main>
  </div>;
}
