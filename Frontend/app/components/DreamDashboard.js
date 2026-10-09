'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './DreamDashboard.module.css';

// A local UI preview can use the deployed read-only API when a local backend is not running.
// Production keeps same-origin API requests through the Next.js rewrite.
// Keep browser requests on the current origin. Next rewrites /api to the
// backend internally, so visitors never need a direct backend host.
const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
const ethnicities = [['', 'All backgrounds'], ['white', 'White'], ['asian', 'Asian'], ['arab', 'Arab'], ['ebony', 'Ebony'], ['indian', 'Indian'], ['latina', 'Latina']];
const sorts = [['hot', 'Trending'], ['links', 'Most linked'], ['newest', 'Recently added'], ['name', 'A–Z']];

const iconPaths = {
  compass: 'M12 2.8 20.5 8l-4.7 10.1L5.7 21.2 3.5 12 12 2.8Zm2.7 7.8-4.5 2.1-2 4.5 4.5-2 2-4.6Z',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  wand: 'm5 19 14-14M8 6l.8 2.2L11 9l-2.2.8L8 12l-.8-2.2L5 9l2.2-.8L8 6Zm9 8 .7 1.7 1.8.7-1.8.7L17 19l-.7-1.9-1.8-.7 1.8-.7L17 14Z',
  message: 'M5 5h14v10H9l-4 4V5Z', user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9c.8-4.1 3.1-6 7-6s6.2 1.9 7 6',
  layers: 'M12 3 4 7l8 4 8-4-8-4Zm-8 8 8 4 8-4M4 15l8 4 8-4', users: 'M16 20v-1.7A4.3 4.3 0 0 0 11.7 14H7.3A4.3 4.3 0 0 0 3 18.3V20M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8.5.2a3.4 3.4 0 0 0 0-6.4m2.8 16.2v-1.7a4.3 4.3 0 0 0-3-4.1',
  heart: 'M20.8 8.8c0 5.5-8.8 10.1-8.8 10.1S3.2 14.3 3.2 8.8A4.7 4.7 0 0 1 12 6.5a4.7 4.7 0 0 1 8.8 2.3Z', download: 'M12 3v11m0 0 4-4m-4 4-4-4M4 20h16', crown: 'm4 7 4.3 4L12 4l3.7 7L20 7l-1.7 11H5.7L4 7Zm2.5 13h11', gift: 'M4 10h16v10H4zM12 10v10M3 6h18v4H3zm5 0a2 2 0 1 1 4 0v.1H8A2 2 0 1 1 8 6Zm8 0a2 2 0 1 0-4 0v.1h4A2 2 0 1 0 16 6Z',
  search: 'M10.7 4.2a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm5.1 11.6 4 4', filter: 'M4 7h9m4 0h3M4 17h3m4 0h9M13 4v6m-6 4v6', sort: 'M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3', chevron: 'm7 10 5 5 5-5', close: 'm6 6 12 12M18 6 6 18', more: 'M5 12h.01M12 12h.01M19 12h.01', bookmark: 'M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.6L6 21V4.5Z',
  database: 'M4 5c0 1.7 3.6 3 8 3s8-1.3 8-3-3.6-3-8-3-8 1.3-8 3Zm0 0v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3', image: 'M4 4h16v16H4zM7 15l3-3 2.5 2.5 2-2L18 16M8 8.5h.01', video: 'M3 7h12v10H3zM21 8l-6 4 6 4V8Z', check: 'm5 12 4 4L19 6', menu: 'M4 7h16M4 12h16M4 17h16', spark: 'M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z', arrow: 'M5 12h13m-5-5 5 5-5 5', clock: 'M12 7v5l3.2 2', info: 'M12 17v-5m0-4h.01',
};

export function DashboardIcon({ name, size = 18, className = '' }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d={iconPaths[name] || iconPaths.spark} /></svg>;
}

function initials(value = '') {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'DP';
}

function formatCount(value) { return Number(value || 0).toLocaleString(); }

export function DashboardBrand() {
  return <Link href="/" className={styles.brand} aria-label="LeakPorns Discover home"><img className={styles.brandLogo} src="/7035402.svg" alt="LeakPorns" /><span>Leak<span>Porns</span></span></Link>;
}

const navGroups = [
  ['Menu', [['Discover', 'compass', '/'], ['Explore', 'grid', '/creators'], ['Studio', 'wand'], ['Chat', 'message', '/chat'], ['Account', 'user', '/auth/sign-in']]],
  ['Library', [['Collections', 'layers'], ['Creators', 'users', '/creators'], ['Favorites', 'heart'], ['Downloads', 'download']]],
  ['Other', [['Upgrade', 'crown', '/upgrade'], ['Rewards', 'gift']]],
];

export function DashboardSidebar({ active, savedCount, onUnavailable, mobileOpen, onClose }) {
  const [auth, setAuth] = useState({ loading: true, user: null });
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBase}/api/auth/me`, { signal: controller.signal, cache: 'no-store' })
      .then(response => response.ok ? response.json() : { user: null })
      .then(data => setAuth({ loading: false, user: data.user || null }))
      .catch(() => setAuth({ loading: false, user: null }));
    return () => controller.abort();
  }, []);
  const signOut = async () => {
    try { await fetch(`${apiBase}/api/auth/logout`, { method: 'POST', credentials: 'same-origin' }); } finally { window.location.assign('/discover'); }
  };
  const accountName = auth.user?.displayName || auth.user?.email || 'Sign in';
  const accountInitials = initials(accountName);
  const item = ([label, icon, href]) => href ? <Link key={label} href={href} className={active === label ? styles.activeNav : ''}><DashboardIcon name={icon} /><span>{label}</span>{label === 'Upgrade' && <b>Pro</b>}{label === 'Favorites' && savedCount ? <em>{savedCount}</em> : null}</Link> : <button key={label} type="button" onClick={() => onUnavailable(`${label} is coming soon.`)}><DashboardIcon name={icon} /><span>{label}</span>{label === 'Favorites' && savedCount ? <em>{savedCount}</em> : null}</button>;
  return <>
    <aside className={`${styles.sidebar}${mobileOpen ? ` ${styles.sidebarOpen}` : ''}`} aria-label="LeakPorns navigation">
      <div className={styles.sidebarTop}><DashboardBrand /><button className={styles.mobileClose} type="button" onClick={onClose} aria-label="Close navigation"><DashboardIcon name="close" /></button></div>
      <nav>{navGroups.map(([heading, items]) => <section key={heading}><p>{heading}</p>{items.map(item)}</section>)}</nav>
      <div className={styles.sidebarFoot}><div className={styles.credit}><DashboardIcon name="spark" size={15} /><span>2,450 credits</span><Link href="/upgrade">Top up</Link></div>{auth.loading ? <div className={styles.accountButton} aria-label="Checking sign-in status"><span>…</span><i><strong>Loading account</strong><small>Please wait</small></i></div> : auth.user ? <button className={styles.accountButton} type="button" onClick={signOut} title="Sign out"><span>{accountInitials}</span><i><strong>{accountName}</strong><small>{auth.user.plan === 'free' ? 'Free plan · Sign out' : `${auth.user.plan} plan · Sign out`}</small></i><DashboardIcon name="chevron" size={15} /></button> : <Link className={styles.accountButton} href="/auth/sign-in"><span>LP</span><i><strong>Sign in</strong><small>Guest</small></i><DashboardIcon name="chevron" size={15} /></Link>}</div>
    </aside>
    {mobileOpen && <button className={styles.navScrim} type="button" aria-label="Close navigation" onClick={onClose} />}
  </>;
}

function CreatorCard({ creator, saved, onSave, onPreview, eager = false }) {
  const isTrending = Number(creator.trendingCount) > 0;
  return <article className={styles.creatorCard}>
    <Link href={`/creator/${encodeURIComponent(creator.slug)}`} className={styles.creatorMedia} aria-label={`Open ${creator.name}'s profile`}><img src={creator.profileImageUrl || '/7035402.svg'} alt={`${creator.name} creator profile`} loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : 'auto'} decoding="async" /><span className={`${styles.contentBadge}${isTrending ? ` ${styles.trendingBadge}` : ''}`}>{isTrending ? 'Trending' : 'Creator'}</span><span className={styles.mediaShade} /><span className={styles.cardIdentity}><i>{initials(creator.name)}</i><span><strong>{creator.name}</strong>{isTrending && <DashboardIcon name="check" size={14} />}<small>{creator.summaryDisplay || 'Creator profile'}</small></span></span></Link>
    <button type="button" className={styles.cardMenu} onClick={() => onPreview(creator)} aria-label={`Preview ${creator.name}`}><DashboardIcon name="more" /></button>
    <div className={styles.creatorBody}><dl><div><DashboardIcon name="database" size={14} /><dt>Links</dt><dd>{formatCount(creator.openLinkCount)}</dd></div><div><DashboardIcon name="spark" size={14} /><dt>Trending</dt><dd>{formatCount(creator.trendingCount)}</dd></div></dl><div className={styles.cardActions}><Link href={`/creator/${encodeURIComponent(creator.slug)}`}>View profile <DashboardIcon name="arrow" size={15} /></Link><button type="button" aria-label={`${saved ? 'Remove' : 'Save'} ${creator.name}`} aria-pressed={saved} onClick={() => onSave(creator.id)}><DashboardIcon name="bookmark" size={17} className={saved ? styles.savedIcon : ''} /></button></div></div>
  </article>;
}

function PreviewDialog({ creator, saved, onClose, onSave }) {
  if (!creator) return null;
  return <div className={styles.previewLayer} role="presentation" onClick={onClose}><section className={styles.previewDialog} role="dialog" aria-modal="true" aria-labelledby="creator-preview-title" onClick={event => event.stopPropagation()}><button className={styles.dialogClose} type="button" onClick={onClose} aria-label="Close creator preview"><DashboardIcon name="close" /></button><img src={creator.profileImageUrl || '/7035402.svg'} alt="" /><div className={styles.previewCopy}><span>{Number(creator.trendingCount) ? 'TRENDING CREATOR' : 'CREATOR PROFILE'}</span><h2 id="creator-preview-title">{creator.name}</h2><p>{creator.summaryDisplay || 'Explore available creator links and media.'}</p><dl><div><small>Open links</small><strong>{formatCount(creator.openLinkCount)}</strong></div><div><small>Trending links</small><strong>{formatCount(creator.trendingCount)}</strong></div></dl><div><Link href={`/creator/${encodeURIComponent(creator.slug)}`}>Open profile <DashboardIcon name="arrow" size={16} /></Link><button type="button" aria-pressed={saved} onClick={() => onSave(creator.id)}><DashboardIcon name="bookmark" size={16} />{saved ? 'Saved' : 'Save creator'}</button></div></div></section></div>;
}

export function DiscoverDashboard({ initialData = {}, page = 'discover' }) {
  const initialItems = initialData.items || [];
  const [creators, setCreators] = useState(initialItems);
  const [total, setTotal] = useState(initialData.total || initialItems.length);
  const [queryDraft, setQueryDraft] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(page === 'creators' ? 'name' : 'hot');
  const [ethnicity, setEthnicity] = useState('');
  const [trendingOnly, setTrendingOnly] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [saved, setSaved] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [notice, setNotice] = useState('');
  const firstFetch = useRef(true);

  useEffect(() => {
    try { const stored = JSON.parse(window.localStorage.getItem('dreamproject-saved-creators') || '[]'); if (Array.isArray(stored)) setSaved(stored); } catch { /* storage is optional */ }
  }, []);
  useEffect(() => { try { window.localStorage.setItem('dreamproject-saved-creators', JSON.stringify(saved)); } catch { /* storage is optional */ } }, [saved]);
  useEffect(() => {
    if (firstFetch.current && initialItems.length && !query && !ethnicity && sort === (page === 'creators' ? 'name' : 'hot')) { firstFetch.current = false; return; }
    firstFetch.current = false;
    const controller = new AbortController();
    const load = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ sort, limit: '30', offset: '0' });
        if (query) params.set('query', query);
        if (ethnicity) params.set('ethnicity', ethnicity);
        const response = await fetch(`${apiBase}/api/models?${params}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(6000)]) });
        if (!response.ok) throw new Error('Creator catalogue is unavailable.');
        const data = await response.json();
        setCreators(data.items || []); setTotal(data.total || 0);
      } catch (error) { if (error.name !== 'AbortError') setNotice('Could not refresh creators. Please try again.'); }
      finally { if (!controller.signal.aborted) setIsLoading(false); }
    };
    load();
    return () => controller.abort();
  }, [ethnicity, initialItems.length, page, query, sort]);
  useEffect(() => { if (!notice) return undefined; const timer = window.setTimeout(() => setNotice(''), 3200); return () => window.clearTimeout(timer); }, [notice]);

  const visibleCreators = useMemo(() => creators.filter(creator => !trendingOnly || Number(creator.trendingCount) > 0), [creators, trendingOnly]);
  const filterCount = Number(Boolean(ethnicity)) + Number(trendingOnly);
  const title = page === 'creators' ? 'Explore creators' : 'Discover';
  const subtitle = page === 'creators' ? 'Search the creator directory and open profiles with available links.' : 'Explore trending creators and newly added collections.';
  const toggleSaved = id => setSaved(items => items.includes(id) ? items.filter(item => item !== id) : [...items, id]);
  const resetFilters = () => { setEthnicity(''); setTrendingOnly(false); setFilterOpen(false); };
  const chooseChip = value => { if (value === 'all') { setQuery(''); setQueryDraft(''); setSort(page === 'creators' ? 'name' : 'hot'); setTrendingOnly(false); } if (value === 'trending') { setSort('hot'); setTrendingOnly(true); } if (value === 'links') { setSort('links'); setTrendingOnly(false); } if (value === 'new') { setSort('newest'); setTrendingOnly(false); } };
  const loadMore = async () => {
    if (isLoadingMore || creators.length >= total) return;
    setIsLoadingMore(true);
    try {
      const params = new URLSearchParams({ sort, limit: '30', offset: String(creators.length) }); if (query) params.set('query', query); if (ethnicity) params.set('ethnicity', ethnicity);
      const response = await fetch(`${apiBase}/api/models?${params}`, { signal: AbortSignal.timeout(6000) }); if (!response.ok) throw new Error(); const data = await response.json(); setCreators(items => [...items, ...(data.items || [])]); setTotal(data.total || total);
    } catch { setNotice('Could not load more creators.'); } finally { setIsLoadingMore(false); }
  };

  return <div className={styles.dashboard}>
    <DashboardSidebar active={page === 'creators' ? 'Creators' : 'Discover'} savedCount={saved.length} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} onUnavailable={setNotice} />
    <main className={styles.main}>
      <div className={styles.backGlow} /><header className={styles.mobileHeader}><DashboardBrand /><button type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><DashboardIcon name="menu" /></button></header>
      <section className={styles.toolbar} aria-label="Creator discovery controls"><form className={styles.searchBox} onSubmit={event => { event.preventDefault(); setQuery(queryDraft.trim()); }}><DashboardIcon name="search" /><label className={styles.srOnly} htmlFor="dashboard-search">Search creators</label><input id="dashboard-search" value={queryDraft} onChange={event => setQueryDraft(event.target.value)} placeholder="Search creators, collections or content…" />{queryDraft && <button className={styles.clearSearch} type="button" onClick={() => { setQueryDraft(''); setQuery(''); }} aria-label="Clear search"><DashboardIcon name="close" size={15} /></button>}<kbd>/</kbd><span className={styles.toolbarDivider} /><button className={styles.toolbarButton} type="button" aria-expanded={filterOpen} onClick={() => { setFilterOpen(value => !value); setSortOpen(false); }}><DashboardIcon name="filter" /> <span>Filter</span>{filterCount ? <b>{filterCount}</b> : null}</button><button className={styles.toolbarButton} type="button" aria-expanded={sortOpen} onClick={() => { setSortOpen(value => !value); setFilterOpen(false); }}><DashboardIcon name="sort" /><span>{sorts.find(item => item[0] === sort)?.[1]}</span><DashboardIcon name="chevron" size={14} /></button></form><Link href="/creators" className={styles.creatorDirectory}><DashboardIcon name="users" />Creators</Link>
        {sortOpen && <div className={styles.sortMenu} role="menu">{sorts.map(([value, label]) => <button key={value} type="button" role="menuitemradio" aria-checked={sort === value} onClick={() => { setSort(value); setSortOpen(false); }}><span>{label}</span>{sort === value && <DashboardIcon name="check" size={16} />}</button>)}</div>}
        {filterOpen && <section className={styles.filterPanel} aria-label="Creator filters"><div><strong>Filters</strong><button type="button" onClick={resetFilters}>Reset</button></div><label>Background<select value={ethnicity} onChange={event => setEthnicity(event.target.value)}>{ethnicities.map(([value, label]) => <option key={value || 'all'} value={value}>{label}</option>)}</select></label><button className={styles.switchRow} type="button" aria-pressed={trendingOnly} onClick={() => setTrendingOnly(value => !value)}><span><b>Trending creators only</b><small>Show profiles with active trending links</small></span><i className={trendingOnly ? styles.switchOn : ''}><em /></i></button><button className={styles.applyFilters} type="button" onClick={() => setFilterOpen(false)}>Apply filters</button></section>}
      </section>
      <section className={styles.heading}><div><p>— {page === 'creators' ? 'CREATOR LIBRARY' : 'DISCOVER'}</p><h1>{title}</h1><span>{subtitle}</span></div><small>{formatCount(total)} creators available</small></section>
      <div className={styles.chips} aria-label="Quick creator filters"><button className={!query && !trendingOnly && sort === (page === 'creators' ? 'name' : 'hot') ? styles.selectedChip : ''} type="button" onClick={() => chooseChip('all')}>All</button><button className={trendingOnly ? styles.selectedChip : ''} type="button" onClick={() => chooseChip('trending')}>Trending</button><button className={sort === 'links' ? styles.selectedChip : ''} type="button" onClick={() => chooseChip('links')}>Most linked</button><button className={sort === 'newest' ? styles.selectedChip : ''} type="button" onClick={() => chooseChip('new')}>New arrivals</button></div>
      {isLoading ? <div className={styles.skeletonGrid} aria-label="Loading creators">{Array.from({ length: 8 }, (_, index) => <div key={index} />)}</div> : visibleCreators.length ? <section className={styles.creatorGrid} aria-label="Creator results">{visibleCreators.map((creator, index) => <CreatorCard key={creator.id} creator={creator} eager={index === 0} saved={saved.includes(creator.id)} onSave={toggleSaved} onPreview={setPreview} />)}</section> : <section className={styles.empty}><DashboardIcon name="search" size={28} /><h2>No creators found</h2><p>Try another search term or remove the active filters.</p><button type="button" onClick={() => { setQuery(''); setQueryDraft(''); resetFilters(); }}>Clear filters</button></section>}
      {creators.length < total && <button className={styles.loadMore} type="button" onClick={loadMore} disabled={isLoadingMore}>{isLoadingMore ? 'Loading creators…' : 'Load more creators'} <DashboardIcon name="arrow" size={16} /></button>}
    </main>
    <nav className={styles.bottomNav} aria-label="Mobile navigation"><Link href="/discover" className={page === 'discover' ? styles.bottomActive : ''}><DashboardIcon name="compass" /><span>Home</span></Link><Link href="/creators" className={page === 'creators' ? styles.bottomActive : ''}><DashboardIcon name="grid" /><span>Explore</span></Link><button type="button" onClick={() => setNotice('Studio is coming soon.')}><DashboardIcon name="wand" /><span>Studio</span></button><button type="button" onClick={() => setNotice('Saved creator lists are coming soon.')}><DashboardIcon name="bookmark" /><span>Saved</span></button><button type="button" onClick={() => setNotice('Account features are coming soon.')}><DashboardIcon name="user" /><span>Profile</span></button></nav>
    <PreviewDialog creator={preview} saved={preview && saved.includes(preview.id)} onClose={() => setPreview(null)} onSave={toggleSaved} />
    {notice && <div className={styles.toast} role="status"><DashboardIcon name="info" size={16} />{notice}</div>}
  </div>;
}

const plans = [
  { id: 'free', name: 'Free', subtitle: 'Explore LeakPorns', monthly: 0, yearly: 0, badge: 'CURRENT PLAN', features: ['Limited creator browsing', '3 daily discovery credits', 'Public creator profiles', 'Standard support'] },
  { id: 'plus', name: 'LeakPorns Plus', subtitle: 'Everything you need every day', monthly: 799, yearly: 7990, badge: 'MOST POPULAR', accent: true, features: ['Full creator directory', '25 discovery credits per day', 'Premium creator profiles', 'No advertising', 'Priority support'] },
  { id: 'ultra', name: 'LeakPorns Ultra', subtitle: 'The complete LeakPorns experience', monthly: 1499, yearly: 14990, badge: 'BEST VALUE', features: ['Everything in LeakPorns Plus', 'Unlimited standard credits', 'Exclusive creator collections', 'HD / 4K where available', 'Early access features'] },
];

export function UpgradeDashboard() {
  const [billing, setBilling] = useState('monthly');
  const [compare, setCompare] = useState(false);
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState('');
  const price = plan => billing === 'monthly' ? plan.monthly : plan.yearly;
  const priceLabel = plan => price(plan) ? `₹${price(plan).toLocaleString('en-IN')}` : 'Free';
  useEffect(() => { if (!notice) return undefined; const timer = window.setTimeout(() => setNotice(''), 3000); return () => window.clearTimeout(timer); }, [notice]);
  return <div className={styles.dashboard}>
    <DashboardSidebar active="Upgrade" savedCount={0} mobileOpen={false} onClose={() => {}} onUnavailable={setNotice} />
    <main className={styles.main}>
      <div className={styles.backGlow} />
      <header className={styles.mobileHeader}><DashboardBrand /><Link className={styles.mobileUpgradeBack} href="/discover">Discover</Link></header>
      <section className={styles.upgradeHero}>
        <span><DashboardIcon name="spark" size={13} />UPGRADE</span><h1>Upgrade your LeakPorns plan</h1><p>Choose the plan that matches how you explore, create and use LeakPorns.</p>
        <div className={styles.billingToggle} role="group" aria-label="Choose billing period"><button className={billing === 'monthly' ? styles.billingActive : ''} type="button" onClick={() => setBilling('monthly')}>Monthly</button><button className={billing === 'yearly' ? styles.billingActive : ''} type="button" onClick={() => setBilling('yearly')}>Yearly <b>Save 17%</b></button></div>
      </section>
      <section className={styles.pricingGrid}>{plans.map(plan => <article className={`${styles.pricingCard}${plan.accent ? ` ${styles.featuredPlan}` : ''}`} key={plan.id}>
        {plan.accent && <span className={styles.popularTag}>MOST POPULAR</span>}<span>{plan.badge}</span><h2>{plan.name}</h2><p>{plan.subtitle}</p>
        <div className={styles.price}><strong>{priceLabel(plan)}</strong>{price(plan) ? <small>/ {billing === 'monthly' ? 'month' : 'year'}</small> : null}</div>
        {billing === 'yearly' && price(plan) ? <em>Billed annually · save ₹{(plan.monthly * 12 - plan.yearly).toLocaleString('en-IN')}</em> : <em>Start exploring today</em>}
        <ul>{plan.features.map(feature => <li key={feature}><DashboardIcon name="check" size={16} />{feature}</li>)}</ul>
        <button type="button" disabled={plan.id === 'free'} onClick={() => setSelected(plan)}>{plan.id === 'free' ? 'Current plan' : `Choose ${plan.name}`}<DashboardIcon name="arrow" size={16} /></button>
      </article>)}</section>
      <section className={styles.paymentPanel}><div><i><DashboardIcon name="check" size={20} /></i><span><strong>Secure payments</strong><small>Pay with the methods you already use.</small></span></div><p><b>UPI</b><b>VISA</b><b>Mastercard</b><b>PayPal</b></p></section>
      <button className={styles.compareButton} type="button" aria-expanded={compare} onClick={() => setCompare(value => !value)}>Compare all features <DashboardIcon name="chevron" className={compare ? styles.rotated : ''} /></button>
      {compare && <section className={styles.comparison}><div><strong>Feature</strong>{plans.map(plan => <strong key={plan.id}>{plan.name}</strong>)}</div>{[['Creator library', ['Public', 'Full', 'Premium + exclusive']], ['Discovery credits', ['3 daily', '25 daily', 'Unlimited*']], ['Ads', ['Included', 'None', 'None']], ['Support', ['Standard', 'Priority', 'Priority']]].map(([feature, values]) => <div key={feature}><span>{feature}</span>{values.map(value => <span key={value}>{value}</span>)}</div>)}</section>}
    </main>
    <nav className={styles.bottomNav} aria-label="Mobile navigation"><Link href="/discover"><DashboardIcon name="compass" /><span>Home</span></Link><Link href="/creators"><DashboardIcon name="grid" /><span>Explore</span></Link><Link href="/upgrade" className={styles.bottomActive}><DashboardIcon name="crown" /><span>Upgrade</span></Link></nav>
    {selected && <div className={styles.previewLayer} role="presentation" onClick={() => setSelected(null)}><section className={styles.checkoutDialog} role="dialog" aria-modal="true" aria-labelledby="upgrade-dialog-title" onClick={event => event.stopPropagation()}><button className={styles.dialogClose} type="button" aria-label="Close checkout" onClick={() => setSelected(null)}><DashboardIcon name="close" /></button><span>CHECKOUT</span><h2 id="upgrade-dialog-title">Upgrade to {selected.name}</h2><p>{priceLabel(selected)} · {billing === 'monthly' ? 'monthly' : 'yearly'} billing</p><label><input defaultChecked type="radio" name="payment" />UPI / Cards</label><label><input type="radio" name="payment" />PayPal</label><button type="button" onClick={() => { setSelected(null); setNotice('Checkout will be available when payments are connected.'); }}>Continue to secure checkout <DashboardIcon name="arrow" size={16} /></button></section></div>}
    {notice && <div className={styles.toast} role="status"><DashboardIcon name="info" size={16} />{notice}</div>}
  </div>;
}
