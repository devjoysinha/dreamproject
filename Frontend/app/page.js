'use client';

import { useEffect, useMemo, useState } from 'react';
import content from '../content.json';
import MobileNav from './components/MobileNav';

const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
const sortOptions = [['newest', 'New'], ['trending', 'Trending'], ['name', 'A–Z']];
const ethnicityOptions = [['', 'All Ethnicities'], ['arab', 'Arab'], ['asian', 'Asian'], ['ebony', 'Ebony'], ['indian', 'Indian'], ['latina', 'Latina'], ['white', 'White']];

const formatSize = bytes => {
  if (!bytes) return '—';
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1_000))} KB`;
  if (bytes < 1_000_000_000) return `${Math.max(1, Math.round(bytes / 1_000_000))} MB`;
  return `${Math.max(1, Math.round(bytes / 1_000_000_000))} GB`;
};
const relativeTime = date => {
  if (!date) return '';
  const minutes = Math.max(1, Math.round((Date.now() - new Date(date).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  if (minutes < 1440) { const hours = Math.round(minutes / 60); return `${hours} hour${hours === 1 ? '' : 's'} ago`; }
  const days = Math.round(minutes / 1440); return `${days} day${days === 1 ? '' : 's'} ago`;
};
const slugify = value => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'model';

function NavIcon({ type }) {
  const paths = { browse: 'M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v6H4zM14 15h6v6h-6z', studio: 'M4 18 12 4l8 14H4Zm8-9v5m0 3h.01', chat: 'M5 5h14v11H9l-4 4V5Z', account: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9c.8-4.1 3.1-6 7-6s6.2 1.9 7 6', lists: 'M7 5h13M7 12h13M7 19h13M3 5h.01M3 12h.01M3 19h.01', models: 'M12 3 4 7v5c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V7l-8-4Z', shop: 'M4 9h16l-1 12H5L4 9Zm3 0a5 5 0 0 1 10 0', rewards: 'm12 3 2.4 5 5.6.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.6-.8L12 3Z' };
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[type]} /></svg>;
}
function SearchIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>; }
function Chevron() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>; }
function ClockIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></svg>; }
function ScanEyeIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3m13 5h3a2 2 0 0 0 2-2v-3" /><path d="M6.5 12s2-3 5.5-3 5.5 3 5.5 3-2 3-5.5 3-5.5-3-5.5-3Z" /><circle cx="12" cy="12" r="1.5" /></svg>; }
function UsersIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3" /><path d="M3.5 19c.4-4 2.2-6 5.5-6s5.1 2 5.5 6M15 5.5a3 3 0 0 1 0 5.5m1.5 2.5c2.5.4 3.8 2.2 4 5.5" /></svg>; }
function KeyIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="12" r="4" /><path d="M12 12h9m-3 0v3m-3-3v2" /></svg>; }
function Flag() { return <svg className="flag" viewBox="0 0 24 16" aria-hidden="true"><rect width="24" height="16" rx="2" fill="#173b73" /><path d="M0 0 24 16M24 0 0 16" stroke="#fff" strokeWidth="4" /><path d="M0 0 24 16M24 0 0 16" stroke="#c7353b" strokeWidth="1.5" /><path d="M12 0v16M0 8h24" stroke="#fff" strokeWidth="5" /><path d="M12 0v16M0 8h24" stroke="#c7353b" strokeWidth="2" /></svg>; }
function LinkIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M9 12h6m-3-3 3 3-3 3" /></svg>; }
function PlusIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14" /></svg>; }
function InfoIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></svg>; }
function MoreIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.1" /><circle cx="12" cy="12" r="1.1" /><circle cx="19" cy="12" r="1.1" /></svg>; }

function fallbackCards() {
  return content.items.filter(item => !item.deleted && ((item.info?.images || 0) + (item.info?.videos || 0) > 0)).map(item => ({
    id: item.id, title: item.title, imageUrl: item.previewMedia || item.media,
    images: item.info?.images || 0, videos: item.info?.videos || 0, sizeBytes: item.info?.size || 0,
    createdAt: item.createdAt, isTrending: Boolean(item.isTrending), megaUrl: item.megaUrl || item.link || '',
    modelSlug: slugify(item.title), modelName: item.title,
  }));
}
function initialHomeQuery() {
  return typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('q') || new URLSearchParams(window.location.search).get('query') || '';
}

function Sidebar() {
  return <aside className="sidebar">
    <a className="brand" href="#top"><img src="/7035402.svg" alt="Leakporns logo" /><span>leak<b>porns</b></span></a>
    <nav className="primary-nav"><p>— Menu</p><a className="selected" href="#top"><NavIcon type="browse" />Browse</a><a href="/studio"><NavIcon type="studio" />Studio</a><a href="/chat"><NavIcon type="chat" />Chat</a><a href="/account"><NavIcon type="account" />Account</a></nav>
    <nav className="library-nav"><p>— Library</p><a href="/lists"><NavIcon type="lists" />My Lists</a><a href="/models"><NavIcon type="models" />Models</a><a href="/shop"><NavIcon type="shop" />Shop</a><a href="/rewards"><NavIcon type="rewards" />Rewards</a></nav>
    <div className="sidebar-tail"><button className="support" type="button" onClick={() => document.getElementById('support-status')?.showModal()}><span className="support-dot" />Support-Chat</button><button className="locale" type="button"><Flag /> English <Chevron /></button></div>
    <button className="balance" type="button" aria-label="Open balance details"><KeyIcon /><span>2</span><i /><PlusIcon /></button>
    <div className="account-chip"><span className="notice">3</span><span className="profile">LS</span><div><b>Sign in</b><small>Guest</small></div></div>
    <dialog id="support-status" className="utility-dialog"><form method="dialog"><button className="dialog-close" aria-label="Close">×</button><h2>Support chat</h2><p>Support chat will be available when account sign-in is enabled.</p><button className="dialog-primary">Close</button></form></dialog>
  </aside>;
}

function toCard(item) { return { ...item, imageUrl: item.imageUrl || item.media, images: item.images || 0, videos: item.videos || 0 }; }

export default function Home() {
  const fallback = useMemo(fallbackCards, []);
  const [items, setItems] = useState(fallback);
  const [total, setTotal] = useState(fallback.length);
  const [query, setQuery] = useState(initialHomeQuery);
  const [panelQuery, setPanelQuery] = useState(initialHomeQuery);
  const [ethnicity, setEthnicity] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [trendingModels, setTrendingModels] = useState([]);
  const [sort, setSort] = useState('newest');
  const [sortOpen, setSortOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [saved, setSaved] = useState([]);
  const [ageOpen, setAgeOpen] = useState(true);

  useEffect(() => {
    try {
      const storedSaved = JSON.parse(window.localStorage.getItem('leakporns-saved-links') || '[]');
      if (Array.isArray(storedSaved)) setSaved(storedSaved);
      if (window.localStorage.getItem('leakporns-age-verified') === '1') setAgeOpen(false);
    } catch { /* local storage is optional */ }
  }, []);
  useEffect(() => {
    try { window.localStorage.setItem('leakporns-saved-links', JSON.stringify(saved)); } catch { /* local storage is optional */ }
  }, [saved]);
  useEffect(() => {
    if (!searchOpen || trendingModels.length) return;
    fetch(`${apiBase}/api/models?sort=links&limit=8&offset=0`).then(response => response.ok ? response.json() : Promise.reject(new Error('Trending unavailable'))).then(data => setTrendingModels(data.items)).catch(() => setTrendingModels([]));
  }, [searchOpen, trendingModels.length]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ sort, limit: '24', offset: '0' });
        if (query.trim()) params.set('query', query.trim());
        if (ethnicity) params.set('ethnicity', ethnicity);
        const response = await fetch(`${apiBase}/api/open-links?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Catalogue unavailable');
        const data = await response.json();
        setItems(data.items.map(toCard));
        setTotal(data.total);
      } catch (error) {
        if (error.name !== 'AbortError') {
          const term = query.trim().toLowerCase();
          const localItems = fallback.filter(item => `${item.title} ${item.modelName}`.toLowerCase().includes(term));
          setItems(localItems); setTotal(localItems.length);
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, query ? 240 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [ethnicity, fallback, query, sort]);

  const loadMore = async () => {
    if (isLoadingMore || items.length >= total) return;
    setIsLoadingMore(true);
    try {
      const params = new URLSearchParams({ sort, limit: '24', offset: String(items.length) });
      if (query.trim()) params.set('query', query.trim());
      if (ethnicity) params.set('ethnicity', ethnicity);
      const response = await fetch(`${apiBase}/api/open-links?${params}`);
      if (!response.ok) throw new Error('Catalogue unavailable');
      const data = await response.json();
      setItems(current => [...current, ...data.items.map(toCard)]); setTotal(data.total);
    } finally { setIsLoadingMore(false); }
  };
  const toggleSaved = id => setSaved(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const selectedHref = selectedItem?.modelSlug ? `/model/${encodeURIComponent(selectedItem.modelSlug)}` : '/models';
  const activeSort = sortOptions.find(([key]) => key === sort)?.[1] || 'New';
  const openSearch = () => { setPanelQuery(query); setSearchOpen(true); };
  const submitSearch = event => { event.preventDefault(); const nextQuery = panelQuery.trim(); setQuery(nextQuery); setSearchOpen(false); window.history.replaceState(null, '', nextQuery ? `/?q=${encodeURIComponent(nextQuery)}` : '/'); };
  const chooseTrending = model => { const nextQuery = model.name.trim(); setPanelQuery(nextQuery); setQuery(nextQuery); setSearchOpen(false); window.history.replaceState(null, '', `/?q=${encodeURIComponent(nextQuery)}`); };
  const confirmAge = () => { setAgeOpen(false); try { window.localStorage.setItem('leakporns-age-verified', '1'); } catch { /* local storage is optional */ } };

  return <div className="site-shell">
    <Sidebar /><MobileNav active="browse" />
    <main id="top" className="main-content">
      <section className="top-strip">
        <div className="search-panel"><div className="search-row"><div className="search-input"><button className="search-trigger" type="button" aria-expanded={searchOpen} aria-haspopup="dialog" onClick={openSearch}><span className="search-icon-box"><SearchIcon /></span><span>{query ? `“${query}”` : 'Search & Filter'}</span></button><a className="visual-search" href="/visual-search" aria-label="Visual image search"><ScanEyeIcon /></a></div><div className="sort-control"><button className="sort" type="button" aria-expanded={sortOpen} aria-haspopup="listbox" onClick={() => setSortOpen(value => !value)}><ClockIcon /><span>{activeSort}</span><Chevron /></button>{sortOpen && <div className="sort-menu" role="listbox" aria-label="Sort open links">{sortOptions.map(([value, label]) => <button key={value} type="button" role="option" aria-selected={sort === value} className={sort === value ? 'active' : ''} onClick={() => { setSort(value); setSortOpen(false); }}>{label}</button>)}</div>}</div></div></div>
        <a className="models-link" href="/models"><UsersIcon />Models</a>
      </section>
      {searchOpen && <section className="search-sheet" role="dialog" aria-label="Search and Filter"><form className="search-sheet-form" onSubmit={submitSearch}><button className="search-sheet-icon" type="submit" aria-label="Search"><SearchIcon /></button><input autoFocus value={panelQuery} onChange={event => setPanelQuery(event.target.value)} placeholder="Search models..." aria-label="Search models..." /><button className="search-sheet-close" type="button" aria-label="Close search" onClick={() => setSearchOpen(false)}>×</button></form><div className="search-sheet-section"><div className="search-sheet-heading"><h2>Trending now</h2><span>Top {trendingModels.length || 8}</span></div><div className="trend-chips">{trendingModels.map((model, index) => <button key={model.id} type="button" onClick={() => chooseTrending(model)}><small>{String(index + 1).padStart(2, '0')}</small>{model.name}</button>)}</div></div><div className="search-sheet-section"><div className="search-sheet-heading"><h2>Discover</h2><span>Find</span></div><div className="discover-actions"><a href="/visual-search"><ScanEyeIcon />Visual Image Search</a><a href="/models"><UsersIcon />Browse all models</a></div></div><div className="search-sheet-section"><div className="search-sheet-heading"><h2>Ethnicity</h2><span>Filter</span></div><div className="ethnicity-chips">{ethnicityOptions.map(([value, label]) => <button key={value || 'all'} type="button" aria-pressed={ethnicity === value} className={ethnicity === value ? 'active' : ''} onClick={() => setEthnicity(value)}>{label}</button>)}</div></div><a className="bookmark-prompt" href="/account"><span>↪</span><b>Login for Bookmark Lists</b><small>Sign in to filter by your bookmark collections</small></a></section>}
      <section id="models" className="cards-wrap"><div className="cards-grid">{items.map((item, index) => {
        const profileHref = item.modelSlug ? `/model/${encodeURIComponent(item.modelSlug)}` : '/models';
        const openHref = item.megaUrl || profileHref;
        return <article className="media-card" key={`${item.id}-${item.modelSlug || 'model'}`}>
          <div className="warm-glow" /><div className="media-frame"><a className="media-open" href={profileHref} aria-label={`View ${item.modelName || item.title} profile`}><img src={item.imageUrl} alt={item.title} loading={index < 6 ? 'eager' : 'lazy'} /></a>{item.isTrending && <span className="trending">Trending</span>}<button className="card-more" type="button" aria-label={`View details for ${item.title}`} onClick={() => setSelectedItem(item)}><MoreIcon /></button></div>
          <div className="card-details"><h3 title={item.title}>{item.title}</h3><div className="metadata"><span>{item.sizeDisplay || formatSize(item.sizeBytes)}</span><i>·</i><span>{item.images} imgs</span><i>·</i><span>{item.videos} videos</span><i>·</i><span>{item.relativeAge || relativeTime(item.createdAt)}</span><button className="info" type="button" aria-label={`View ${item.title} details`} onClick={() => setSelectedItem(item)}><InfoIcon /></button></div><div className="card-cta"><a className="open-link" href={openHref} target={item.megaUrl ? '_blank' : undefined} rel={item.megaUrl ? 'noreferrer' : undefined}><LinkIcon />Open Link</a><button className="more" type="button" aria-label={`${saved.includes(item.id) ? 'Remove' : 'Save'} ${item.title}`} aria-pressed={saved.includes(item.id)} onClick={() => toggleSaved(item.id)}><PlusIcon /></button></div></div>
        </article>;
      })}</div>{!isLoading && !items.length && <div className="empty-creators"><h2>No links found</h2><p>Try a different creator or link title.</p><button type="button" onClick={() => setQuery('')}>Clear search</button></div>}</section>
      {items.length < total && <button className="load-more" type="button" onClick={loadMore} disabled={isLoadingMore}>{isLoadingMore ? 'Loading…' : 'Load More'} <span>↓</span></button>}
      {isLoading && <p className="catalogue-status" aria-live="polite">Loading open links…</p>}
    </main>
    {selectedItem && <div className="info-layer" role="presentation" onClick={() => setSelectedItem(null)}><section className="info-dialog" role="dialog" aria-modal="true" aria-labelledby="info-title" onClick={event => event.stopPropagation()}><button className="dialog-close" type="button" aria-label="Close details" onClick={() => setSelectedItem(null)}>×</button><p className="eyebrow">— Open link</p><h2 id="info-title">{selectedItem.title}</h2><p className="info-model">{selectedItem.modelName || 'Creator profile'}</p><dl><div><dt>Images</dt><dd>{selectedItem.images}</dd></div><div><dt>Videos</dt><dd>{selectedItem.videos}</dd></div><div><dt>Size</dt><dd>{selectedItem.sizeDisplay || formatSize(selectedItem.sizeBytes)}</dd></div></dl><div className="info-actions"><a href={selectedHref}>View profile</a><a href={selectedItem.megaUrl || selectedHref} target={selectedItem.megaUrl ? '_blank' : undefined} rel={selectedItem.megaUrl ? 'noreferrer' : undefined}>Open link</a></div></section></div>}
    {ageOpen && <div className="age-layer"><div className="age-dialog" role="dialog" aria-modal="true" aria-labelledby="age-title"><button className="age-close" type="button" onClick={confirmAge} aria-label="Close">×</button><div className="age-copy"><h2 id="age-title">This site is for <em>adults only!</em></h2></div><p className="age-description">By entering this website, I acknowledge that I am <b>18 years or older</b> and agree to the <a href="#terms"> Terms of Service </a></p><div className="age-actions"><button className="age-language" type="button"><Flag /> English <Chevron /></button><a href="/models" className="age-login">↪ <span>Browse models</span></a><button className="age-confirm" type="button" onClick={confirmAge}>I am 18 or older</button></div></div></div>}
  </div>;
}
