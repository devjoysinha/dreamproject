'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import MobileNav from '../../components/MobileNav';

const apiBase = process.env.NEXT_PUBLIC_API_URL || '';

function Icon({ name }) {
  const paths = {
    browse: 'M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v6H4zM14 15h6v6h-6z',
    studio: 'M4 18 12 4l8 14H4Zm8-9v5m0 3h.01', chat: 'M5 5h14v11H9l-4 4V5Z', account: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9c.8-4.1 3.1-6 7-6s6.2 1.9 7 6',
    lists: 'M7 5h13M7 12h13M7 19h13M3 5h.01M3 12h.01M3 19h.01', models: 'M12 3 4 7v5c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V7l-8-4Z', shop: 'M4 9h16l-1 12H5L4 9Zm3 0a5 5 0 0 1 10 0', rewards: 'm12 3 2.4 5 5.6.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.6-.8L12 3Z',
    search: 'm16 16 4 4', scan: 'M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3m13 5h3a2 2 0 0 0 2-2v-3M6.5 12s2-3 5.5-3 5.5 3 5.5 3-2 3-5.5 3-5.5-3-5.5-3Z',
    clock: 'M12 7v5l3 2', bookmark: 'M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.6L6 21V4.5Z', share: 'm8 12 8-5m-8 5 8 5M7 14a3 3 0 1 0 0-4 3 3 0 0 0 0 4Zm10-5a3 3 0 1 0 0-4 3 3 0 0 0 0 4Zm0 12a3 3 0 1 0 0-4 3 3 0 0 0 0 4Z', grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z', plus: 'M5 12h14M12 5v14', link: 'M9 12h6m-3-3 3 3-3 3M4 12a8 8 0 0 1 8-8', more: 'M5 12h.01M12 12h.01M19 12h.01', users: 'M9 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6m-5 11c.4-4 2.2-6 5-6s4.6 2 5 6m2-14a3 3 0 0 1 0 5.5m1.5 2.5c2.5.4 3.8 2.2 4 5.5', key: 'M12 12h9m-3 0v3m-3-3v2',
  };
  if (name === 'search') return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d={paths.search} /></svg>;
  if (name === 'clock') return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d={paths.clock} /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} /></svg>;
}
function Flag() { return <svg className="flag" viewBox="0 0 24 16" aria-hidden="true"><rect width="24" height="16" rx="2" fill="#173b73" /><path d="M0 0 24 16M24 0 0 16" stroke="#fff" strokeWidth="4" /><path d="M0 0 24 16M0 16 24 0" stroke="#c7353b" strokeWidth="1.5" /><path d="M12 0v16M0 8h24" stroke="#fff" strokeWidth="5" /><path d="M12 0v16M0 8h24" stroke="#c7353b" strokeWidth="2" /></svg>; }

function DetailSidebar() {
  const row = (href, icon, label, selected = false) => <a className={selected ? 'selected' : ''} href={href}><Icon name={icon} />{label}</a>;
  return <aside className="sidebar detail-sidebar"><a className="brand" href="/"><img src="/7035402.svg" alt="Leakporns logo" /><span>leak<b>porns</b></span></a><nav className="primary-nav"><p>— Menu</p>{row('/', 'browse', 'Browse')}{row('#studio', 'studio', 'Studio')}{row('#chat', 'chat', 'Chat')}{row('#account', 'account', 'Account')}</nav><nav className="library-nav"><p>— Library</p>{row('#lists', 'lists', 'My Lists')}{row('/models', 'models', 'Models', true)}{row('#shop', 'shop', 'Shop')}{row('#rewards', 'rewards', 'Rewards')}</nav><div className="sidebar-tail"><button className="support" type="button"><span className="support-dot" />Support-Chat</button><button className="locale" type="button"><Flag /> English <span>⌄</span></button></div><button className="balance" type="button" aria-label="Open balance details"><Icon name="key" /><span>3</span><i /><Icon name="plus" /></button><div className="account-chip"><span className="profile">LS</span><div><b>Sign in</b><small>Guest</small></div></div></aside>;
}

function stats(link) { return [link.sizeDisplay || '—', `${link.images || 0} imgs`, `${link.videos || 0} videos`, link.relativeAge].filter(Boolean).join(' · '); }

export default function ModelDetailPage() {
  const params = useParams();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const [model, setModel] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBase}/api/models/${encodeURIComponent(slug)}?limit=24`, { signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject(new Error(response.status === 404 ? 'This profile has not been imported yet.' : 'Profile unavailable.')))
      .then(setModel)
      .catch(fetchError => { if (fetchError.name !== 'AbortError') setError(fetchError.message); });
    return () => controller.abort();
  }, [slug]);

  return <div className="site-shell detail-shell"><DetailSidebar /><MobileNav active="models" /><main className="detail-main"><header className="detail-top"><form className="detail-search" action="/models"><span><Icon name="search" /></span><input name="query" defaultValue={model?.name ? `“${model.name}”` : ''} placeholder="Search & Filter" aria-label="Search models" /><button type="submit" aria-label="Search visually"><Icon name="scan" /></button><i /><b><Icon name="clock" /> New</b></form><a className="detail-models-link" href="/models"><Icon name="users" />Models</a></header>{error && <section className="detail-message"><h1>Model catalogue is ready to connect</h1><p>{error} Run the backend migration and importer, then reload this profile.</p><a href="/models">Return to models</a></section>}{!model && !error && <section className="detail-message"><p>Loading creator profile…</p></section>}{model && <section className="detail-layout"><aside className="profile-column"><article className="profile-hero"><img src={model.profileImageUrl} alt={`${model.name} profile`} /><div /><h1>{model.name}</h1><p>{model.summaryDisplay}</p></article><div className="profile-actions"><button type="button" aria-pressed={saved} aria-label={saved ? 'Remove saved profile' : 'Save profile'} onClick={() => setSaved(value => !value)}><Icon name="bookmark" /></button><button type="button"><Icon name="share" />Share</button><a href="/models"><Icon name="grid" />All Models</a></div><section className="profile-bio"><p className="eyebrow">— Bio</p><p>{model.bio || 'No biography is available for this creator yet.'}</p>{Object.entries(model.profileMeta || {}).slice(0, 5).map(([key, value]) => <span key={key}><b>{key}</b>{value}</span>)}</section></aside><section className="detail-media" aria-label={`${model.name} open links`}>{model.openLinks.map(link => <article className="detail-media-card" key={`${link.contentId}-${link.position}`}><img src={link.imageUrl} alt={link.title} loading="lazy" />{link.isTrending && <span className="trending">Trending</span>}<button type="button" className="card-more" aria-label={`More actions for ${link.title}`}><Icon name="more" /></button><div className="detail-card-copy"><h2>{link.title}</h2><p>{stats(link)}</p><div><a href={link.megaUrl || '#'} target="_blank" rel="noreferrer"><Icon name="link" />Open Link</a><button type="button" aria-label={`Add ${link.title}`}><Icon name="plus" /></button></div></div></article>)}</section></section>}</main></div>;
}
