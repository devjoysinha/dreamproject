'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DashboardBrand, DashboardIcon, DashboardSidebar } from './DreamDashboard';
import styles from './DreamDashboard.module.css';

// Keep browser requests on the current origin. Next rewrites /api to the
// backend internally, so visitors never need a direct backend host.
const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
const sortOptions = [['newest', 'Recently added'], ['trending', 'Trending first'], ['name', 'Creator A–Z']];
const ethnicities = [['', 'All backgrounds'], ['white', 'White'], ['asian', 'Asian'], ['arab', 'Arab'], ['ebony', 'Ebony'], ['indian', 'Indian'], ['latina', 'Latina']];

function formatCount(value) { return Number(value || 0).toLocaleString(); }
function formatMedia(item) { return `${Number(item.images || 0)} photos · ${Number(item.videos || 0)} videos`; }

function LinkPreview({ item, onClose }) {
  if (!item) return null;
  const title = item.title || 'Untitled collection';
  const profileHref = item.modelSlug ? `/creator/${encodeURIComponent(item.modelSlug)}` : '/creators';
  return <div className={styles.previewLayer} role="presentation" onClick={onClose}>
    <section className={styles.mediaDialog} role="dialog" aria-modal="true" aria-labelledby="discover-link-title" onClick={event => event.stopPropagation()}>
      <button className={styles.dialogClose} type="button" aria-label="Close link preview" onClick={onClose}><DashboardIcon name="close" /></button>
      <div className={styles.mediaDialogVisual}>{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <div className={styles.mediaFallback}><DashboardIcon name="image" size={35} /></div>}{item.isTrending && <span className={styles.discoverTrending}>Trending</span>}</div>
      <div className={styles.mediaDialogCopy}><span>OPEN LINK</span><h2 id="discover-link-title">{title}</h2><p>{item.modelName || 'Independent collection'} · {item.relativeAge || 'Recently added'}</p><dl><div><small>Media</small><strong>{formatMedia(item)}</strong></div><div><small>Size</small><strong>{item.sizeDisplay || '—'}</strong></div></dl><div className={styles.mediaDialogActions}>{item.megaUrl ? <a href={item.megaUrl} target="_blank" rel="noreferrer">Open link <DashboardIcon name="arrow" size={16} /></a> : <Link href={profileHref}>View profile <DashboardIcon name="user" size={16} /></Link>}<Link href={profileHref}>Creator profile</Link></div></div>
    </section>
  </div>;
}

function OpenLinkCard({ item, saved, onSave, onPreview }) {
  const title = item.title || 'Untitled collection';
  const profileHref = item.modelSlug ? `/creator/${encodeURIComponent(item.modelSlug)}` : '/creators';
  return <article className={styles.discoverLinkCard}>
    <button type="button" className={styles.discoverLinkMedia} onClick={() => onPreview(item)} aria-label={`Preview ${title}`}>
      {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <span className={styles.discoverLinkFallback}><DashboardIcon name="image" size={28} /></span>}
      <span className={styles.discoverLinkShade} />
      {item.isTrending && <span className={styles.discoverTrending}>Trending</span>}
      {item.isPremium && <span className={styles.discoverPremium}><DashboardIcon name="crown" size={13} />Premium</span>}
      <span className={styles.discoverPreview}><DashboardIcon name="search" size={16} /></span>
    </button>
    <div className={styles.discoverLinkBody}>
      <Link href={profileHref} className={styles.discoverCreator}>{item.modelName || 'Creator profile'}<DashboardIcon name="arrow" size={13} /></Link>
      <h2 title={title}>{title}</h2>
      <p>{item.sizeDisplay || '—'}<span>{formatMedia(item)}</span></p>
      <small><DashboardIcon name="clock" size={13} />{item.relativeAge || 'Recently added'}</small>
      <div className={styles.discoverLinkActions}>{item.megaUrl ? <a href={item.megaUrl} target="_blank" rel="noreferrer">Open link <DashboardIcon name="arrow" size={14} /></a> : <Link href={profileHref}>Open link <DashboardIcon name="arrow" size={14} /></Link>}<button type="button" aria-label={`${saved ? 'Remove' : 'Save'} ${title}`} aria-pressed={saved} onClick={() => onSave(item.id)}><DashboardIcon name="bookmark" size={16} className={saved ? styles.savedIcon : ''} /></button></div>
    </div>
  </article>;
}

export function DiscoverLinksDashboard({ initialData = {} }) {
  const initialItems = initialData.items || [];
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialData.total || initialItems.length);
  const [queryDraft, setQueryDraft] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [ethnicity, setEthnicity] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    try { const values = JSON.parse(window.localStorage.getItem('dreamproject-saved-links') || '[]'); if (Array.isArray(values)) setSaved(values); } catch { /* storage is optional */ }
  }, []);
  useEffect(() => { try { window.localStorage.setItem('dreamproject-saved-links', JSON.stringify(saved)); } catch { /* storage is optional */ } }, [saved]);
  useEffect(() => {
    // The default Browse feed is server-rendered. Keeping it intact avoids a
    // client-side loading flash while hydration completes in development.
    if (initialItems.length && !query && !ethnicity && sort === 'newest') return undefined;
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ sort, limit: '30', offset: '0' });
        if (query) params.set('query', query);
        if (ethnicity) params.set('ethnicity', ethnicity);
        const response = await fetch(`${apiBase}/api/open-links?${params}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(6000)]) });
        if (!response.ok) throw new Error('Link discovery is unavailable.');
        const data = await response.json();
        setItems(data.items || []); setTotal(data.total || 0);
      } catch (error) { if (error.name !== 'AbortError') setNotice('Could not refresh links. Please try again.'); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    };
    load();
    return () => controller.abort();
  }, [ethnicity, initialItems.length, query, sort]);
  useEffect(() => {
    if (!preview) return undefined;
    const closeOnEscape = event => { if (event.key === 'Escape') setPreview(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [preview]);
  useEffect(() => { if (!notice) return undefined; const timer = window.setTimeout(() => setNotice(''), 3200); return () => window.clearTimeout(timer); }, [notice]);

  const filterCount = Number(Boolean(ethnicity));
  const resetFilters = () => { setEthnicity(''); setFilterOpen(false); };
  const toggleSaved = id => setSaved(values => values.includes(id) ? values.filter(value => value !== id) : [...values, id]);
  const loadMore = async () => {
    if (loadingMore || items.length >= total) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ sort, limit: '30', offset: String(items.length) });
      if (query) params.set('query', query);
      if (ethnicity) params.set('ethnicity', ethnicity);
      const response = await fetch(`${apiBase}/api/open-links?${params}`, { signal: AbortSignal.timeout(6000) });
      if (!response.ok) throw new Error();
      const data = await response.json(); setItems(current => [...current, ...(data.items || [])]); setTotal(data.total || total);
    } catch { setNotice('Could not load more links.'); } finally { setLoadingMore(false); }
  };

  return <div className={styles.dashboard}>
    <DashboardSidebar active="Discover" savedCount={saved.length} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} onUnavailable={setNotice} />
    <main className={styles.main}>
      <div className={styles.backGlow} />
      <header className={styles.mobileHeader}><DashboardBrand /><button type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><DashboardIcon name="menu" /></button></header>
      <section className={styles.toolbar} aria-label="Open link discovery controls"><form className={styles.searchBox} onSubmit={event => { event.preventDefault(); setQuery(queryDraft.trim()); }}><DashboardIcon name="search" /><label className={styles.srOnly} htmlFor="link-discovery-search">Search open links</label><input id="link-discovery-search" value={queryDraft} onChange={event => setQueryDraft(event.target.value)} placeholder="Search links or creators…" />{queryDraft && <button className={styles.clearSearch} type="button" onClick={() => { setQueryDraft(''); setQuery(''); }} aria-label="Clear search"><DashboardIcon name="close" size={15} /></button>}<kbd>/</kbd><span className={styles.toolbarDivider} /><button className={styles.toolbarButton} type="button" aria-expanded={filterOpen} onClick={() => { setFilterOpen(value => !value); setSortOpen(false); }}><DashboardIcon name="filter" /><span>Filter</span>{filterCount ? <b>{filterCount}</b> : null}</button><button className={styles.toolbarButton} type="button" aria-expanded={sortOpen} onClick={() => { setSortOpen(value => !value); setFilterOpen(false); }}><DashboardIcon name="sort" /><span>{sortOptions.find(option => option[0] === sort)?.[1]}</span><DashboardIcon name="chevron" size={14} /></button></form><Link href="/creators" className={styles.creatorDirectory}><DashboardIcon name="users" />Creators</Link>
        {sortOpen && <div className={styles.sortMenu} role="menu">{sortOptions.map(([value, label]) => <button key={value} type="button" role="menuitemradio" aria-checked={sort === value} onClick={() => { setSort(value); setSortOpen(false); }}><span>{label}</span>{sort === value && <DashboardIcon name="check" size={16} />}</button>)}</div>}
        {filterOpen && <section className={styles.filterPanel} aria-label="Open link filters"><div><strong>Filters</strong><button type="button" onClick={resetFilters}>Reset</button></div><label>Creator background<select value={ethnicity} onChange={event => setEthnicity(event.target.value)}>{ethnicities.map(([value, label]) => <option key={value || 'all'} value={value}>{label}</option>)}</select></label><button className={styles.applyFilters} type="button" onClick={() => setFilterOpen(false)}>Show links</button></section>}
      </section>
      <section className={styles.heading}><div><p>— OPEN LINKS</p><h1>Discover</h1><span>Browse the newest available links from creators in one feed.</span></div><small>{formatCount(total)} links available</small></section>
      <div className={styles.chips} aria-label="Quick link filters"><button className={!query && !ethnicity && sort === 'newest' ? styles.selectedChip : ''} type="button" onClick={() => { setQuery(''); setQueryDraft(''); setEthnicity(''); setSort('newest'); }}>All links</button><button className={sort === 'trending' ? styles.selectedChip : ''} type="button" onClick={() => setSort('trending')}>Trending</button><button className={sort === 'newest' ? styles.selectedChip : ''} type="button" onClick={() => setSort('newest')}>Recently added</button><Link href="/creators" className={styles.discoverChipLink}>Browse creators <DashboardIcon name="arrow" size={14} /></Link></div>
      {loading ? <div className={styles.linkSkeletonGrid} aria-label="Loading open links">{Array.from({ length: 8 }, (_, index) => <div key={index} />)}</div> : items.length ? <section className={styles.discoverLinkGrid} aria-label="Available direct open links">{items.map(item => <OpenLinkCard key={item.id} item={item} saved={saved.includes(item.id)} onSave={toggleSaved} onPreview={setPreview} />)}</section> : <section className={styles.empty}><DashboardIcon name="search" size={28} /><h2>No open links found</h2><p>Try another creator or link title.</p><button type="button" onClick={() => { setQuery(''); setQueryDraft(''); resetFilters(); }}>Clear filters</button></section>}
      {items.length < total && <button className={styles.loadMore} type="button" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading links…' : 'Load more links'} <DashboardIcon name="arrow" size={16} /></button>}
    </main>
    <nav className={styles.bottomNav} aria-label="Mobile navigation"><Link href="/discover" className={styles.bottomActive}><DashboardIcon name="compass" /><span>Discover</span></Link><Link href="/creators"><DashboardIcon name="grid" /><span>Creators</span></Link><button type="button" onClick={() => setNotice('Saved links are stored on this device.')}><DashboardIcon name="bookmark" /><span>Saved</span></button><Link href="/upgrade"><DashboardIcon name="crown" /><span>Upgrade</span></Link></nav>
    <LinkPreview item={preview} onClose={() => setPreview(null)} />
    {notice && <div className={styles.toast} role="status"><DashboardIcon name="info" size={16} />{notice}</div>}
  </div>;
}
