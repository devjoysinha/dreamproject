'use client';

import { useEffect, useMemo, useState } from 'react';
import content from '../../content.json';

const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
const sorts = [['newest', 'Newest'], ['name', 'A–Z'], ['links', 'Most links']];

function NavIcon({ type }) {
  const paths = { browse: 'M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v6H4zM14 15h6v6h-6z', studio: 'M4 18 12 4l8 14H4Zm8-9v5m0 3h.01', chat: 'M5 5h14v11H9l-4 4V5Z', account: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9c.8-4.1 3.1-6 7-6s6.2 1.9 7 6', lists: 'M7 5h13M7 12h13M7 19h13M3 5h.01M3 12h.01M3 19h.01', models: 'M12 3 4 7v5c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V7l-8-4Z', shop: 'M4 9h16l-1 12H5L4 9Zm3 0a5 5 0 0 1 10 0', rewards: 'm12 3 2.4 5 5.6.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.6-.8L12 3Z' };
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[type]} /></svg>;
}
function Chevron() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>; }
function KeyIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="12" r="4" /><path d="M12 12h9m-3 0v3m-3-3v2" /></svg>; }
function PlusIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14" /></svg>; }
function BookmarkIcon({ filled }) { return <svg viewBox="0 0 24 24" aria-hidden="true" className={filled ? 'is-saved' : ''}><path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.6L6 21V4.5Z" /></svg>; }
function FilterIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14" /><circle cx="9" cy="7" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="11" cy="17" r="1.5" /></svg>; }
function Flag() { return <svg className="flag" viewBox="0 0 24 16" aria-hidden="true"><rect width="24" height="16" rx="2" fill="#173b73" /><path d="M0 0 24 16M24 0 0 16" stroke="#fff" strokeWidth="4" /><path d="M0 0 24 16M24 0 0 16" stroke="#c7353b" strokeWidth="1.5" /><path d="M12 0v16M0 8h24" stroke="#fff" strokeWidth="5" /><path d="M12 0v16M0 8h24" stroke="#c7353b" strokeWidth="2" /></svg>; }

function slugify(value) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'model'; }
function fallbackCards() {
  return content.items.filter(item => !item.deleted).map(item => ({
    id: item.id, slug: slugify(item.title), name: item.title, sourceQuery: item.title, profileImageUrl: item.previewMedia || item.media,
    summaryDisplay: '', openLinkCount: (item.info.images || 0) + (item.info.videos || 0), trendingCount: item.isTrending ? 1 : 0,
  }));
}
function countryFromSummary(summary = '') {
  const matches = summary.match(/\b(?:US|CA|UA|AL|GB|AU|DE|FR|IN|BR)\b/g);
  return matches?.[0]?.toLowerCase() || '';
}
function CountryFlag({ summary }) {
  const country = countryFromSummary(summary);
  if (!country) return null;
  return <span className={`country-flag country-${country}`} aria-label={country.toUpperCase()}><small>{country.toUpperCase()}</small></span>;
}

function Sidebar() {
  return <aside className="sidebar models-sidebar">
    <a className="brand" href="/"><img src="/7035402.svg" alt="Leakporns logo" /><span>leak<b>porns</b></span></a>
    <nav className="primary-nav"><p>— Menu</p><a href="/"><NavIcon type="browse" />Browse</a><a href="#studio"><NavIcon type="studio" />Studio</a><a href="#chat"><NavIcon type="chat" />Chat</a><a href="#account"><NavIcon type="account" />Account</a></nav>
    <nav className="library-nav"><p>— Library</p><a href="#lists"><NavIcon type="lists" />My Lists</a><a className="selected" href="/models" aria-current="page"><NavIcon type="models" />Models</a><a href="#shop"><NavIcon type="shop" />Shop</a><a href="#rewards"><NavIcon type="rewards" />Rewards</a></nav>
    <div className="sidebar-tail"><button className="support" type="button"><span className="support-dot" />Support-Chat</button><button className="locale" type="button"><Flag /> English <Chevron /></button></div>
    <button className="balance" type="button" aria-label="Open balance details"><KeyIcon /><span>3</span><i /><PlusIcon /></button>
    <div className="account-chip"><span className="profile">LS</span><div><b>Sign in</b><small>Guest</small></div></div>
  </aside>;
}

async function loadModels(sort, offset = 0) {
  const response = await fetch(`${apiBase}/api/models?sort=${sort}&limit=30&offset=${offset}`);
  if (!response.ok) throw new Error('Model catalogue is unavailable');
  return response.json();
}

export default function ModelsPage() {
  const fallback = useMemo(fallbackCards, []);
  const [creators, setCreators] = useState(fallback);
  const [total, setTotal] = useState(fallback.length);
  const [saved, setSaved] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState('newest');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    loadModels(sort).then(data => {
      if (!cancelled) { setCreators(data.items); setTotal(data.total); }
    }).catch(() => {
      if (!cancelled) { setCreators(fallback); setTotal(fallback.length); }
    }).finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [fallback, sort]);

  const chooseSort = value => { setSort(value); setShowFilters(false); };
  const loadMore = async () => {
    setIsLoadingMore(true);
    try {
      const data = await loadModels(sort, creators.length);
      setCreators(current => [...current, ...data.items]);
      setTotal(data.total);
    } finally { setIsLoadingMore(false); }
  };
  const toggleSaved = id => setSaved(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const activeSort = sorts.find(([key]) => key === sort)?.[1] || 'Newest';

  return <div className="site-shell models-shell">
    <Sidebar />
    <main className="models-main" id="main-content">
      <header className="models-header"><div><p className="eyebrow">— Models</p><h1>{total.toLocaleString()} <span>creators</span></h1></div><div className="filter-control"><button className="filters-button" type="button" aria-expanded={showFilters} onClick={() => setShowFilters(open => !open)}><FilterIcon />Filters</button>{showFilters && <div className="filters-popover" role="dialog" aria-label="Catalogue order"><p>Order models</p><div>{sorts.map(([value, label]) => <button key={value} className={sort === value ? 'active' : ''} onClick={() => chooseSort(value)} type="button">{label}</button>)}</div></div>}</div></header>
      <p className="models-status" aria-live="polite">{isLoading ? 'Loading model catalogue…' : `Sorted by ${activeSort}`}</p>
      <section className="creator-grid" aria-label="Creators">{creators.map((creator, index) => <article className="creator-card" key={creator.id}>
        <img src={creator.profileImageUrl} alt={`${creator.name} profile`} loading={index < 5 ? 'eager' : 'lazy'} />
        <div className="creator-shade" />
        <CountryFlag summary={creator.summaryDisplay} />
        <button className="bookmark" type="button" aria-label={`${saved.includes(creator.id) ? 'Remove' : 'Save'} ${creator.name}`} aria-pressed={saved.includes(creator.id)} onClick={() => toggleSaved(creator.id)}><BookmarkIcon filled={saved.includes(creator.id)} /></button>
        <a className="creator-copy" href={`/model/${encodeURIComponent(creator.slug)}`}><h2>{creator.name}</h2><p>{creator.sourceQuery ? `@${creator.sourceQuery.replace(/^@/, '')}` : ''}</p>{creator.summaryDisplay && <small>{creator.summaryDisplay.split('·').map((part, partIndex) => <span key={`${part}-${partIndex}`}>{part.trim()}{partIndex < creator.summaryDisplay.split('·').length - 1 && <i />}</span>)}</small>}</a>
      </article>)}</section>
      {creators.length < total && <button className="load-more" type="button" onClick={loadMore} disabled={isLoadingMore}>{isLoadingMore ? 'Loading…' : 'Load more'} <span>↓</span></button>}
    </main>
  </div>;
}
