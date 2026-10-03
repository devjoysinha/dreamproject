'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import MobileNav from '../components/MobileNav';

const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
const ethnicities = [['', 'Ethnicity'], ['white', 'White'], ['asian', 'Asian'], ['arab', 'Arab'], ['ebony', 'Ebony'], ['indian', 'Indian'], ['latina', 'Latina']];
const sorts = [['hot', 'Hot'], ['newest', 'New'], ['name', 'A–Z'], ['links', 'Most links']];
const emptyOptions = { countries: [], bodyTypes: [], cupSizes: [], tags: [] };

function NavIcon({ type }) {
  const paths = { browse: 'M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v6H4zM14 15h6v6h-6z', studio: 'M4 18 12 4l8 14H4Zm8-9v5m0 3h.01', chat: 'M5 5h14v11H9l-4 4V5Z', account: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9c.8-4.1 3.1-6 7-6s6.2 1.9 7 6', lists: 'M7 5h13M7 12h13M7 19h13M3 5h.01M3 12h.01M3 19h.01', models: 'M12 3 4 7v5c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V7l-8-4Z', shop: 'M4 9h16l-1 12H5L4 9Zm3 0a5 5 0 0 1 10 0', rewards: 'm12 3 2.4 5 5.6.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.6-.8L12 3Z' };
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[type]} /></svg>;
}
function Chevron() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>; }
function KeyIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="12" r="4" /><path d="M12 12h9m-3 0v3m-3-3v2" /></svg>; }
function PlusIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14" /></svg>; }
function BookmarkIcon({ filled }) { return <svg viewBox="0 0 24 24" aria-hidden="true" className={filled ? 'is-saved' : ''}><path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.6L6 21V4.5Z" /></svg>; }
function FilterIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14" /><circle cx="9" cy="7" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="11" cy="17" r="1.5" /></svg>; }
function GlobeIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M3.8 9h16.4M3.8 15h16.4M12 3.5c2.2 2.3 3.2 5.1 3.2 8.5S14.2 18.2 12 20.5C9.8 18.2 8.8 15.4 8.8 12S9.8 5.8 12 3.5Z" /></svg>; }
function TagIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 6 2-2h7l7 7-7 7-7-7V6Z" /><circle cx="8.5" cy="7.5" r="1" /></svg>; }
function BodyIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5.5" r="2" /><path d="M8.5 20v-5l1.5-4m5.5 9v-5l-1.5-4M9 9l3 2 3-2M10 15h4" /></svg>; }
function CupIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h12v5a6 6 0 0 1-12 0V7Zm12 2h1.5a2.5 2.5 0 0 1 0 5H17M8 20h6" /></svg>; }
function FlameIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.4 3.5c.4 3-1.8 4.4-2.8 6.1-.6-1.3-1.4-2.2-2.6-2.8.2 3.1-3 4.5-3 8.1A6.9 6.9 0 0 0 12 21.5a6.9 6.9 0 0 0 7-6.6c.1-3.2-2-6.1-5.6-11.4Z" /><path d="M12 21.3c-2.1-1.5-2.7-3.3-1.8-5.1.6-1.1 1.5-1.8 2.1-3.1 1.8 1.4 2.7 3 2.6 4.5-.1 1.7-1.1 3-2.9 3.7Z" /></svg>; }
function SearchIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.2" /><path d="m15.4 15.4 4.2 4.2" /></svg>; }
function CloseIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>; }
function Flag() { return <svg className="flag" viewBox="0 0 24 16" aria-hidden="true"><rect width="24" height="16" rx="2" fill="#173b73" /><path d="M0 0 24 16M24 0 0 16" stroke="#fff" strokeWidth="4" /><path d="M0 0 24 16M24 0 0 16" stroke="#c7353b" strokeWidth="1.5" /><path d="M12 0v16M0 8h24" stroke="#fff" strokeWidth="5" /><path d="M12 0v16M0 8h24" stroke="#c7353b" strokeWidth="2" /></svg>; }

function initialParam(name) { return typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get(name) || ''; }
function initialSort() { const value = initialParam('sort'); return sorts.some(([key]) => key === value) ? value : 'hot'; }
function countryFromSummary(summary = '') { return summary.match(/\b[A-Z]{2}\b/)?.[0] || ''; }
function CountryFlag({ summary }) { const country = countryFromSummary(summary); if (!country) return null; const flag = String.fromCodePoint(...[...country].map(letter => 127397 + letter.charCodeAt(0))); return <span className="country-flag" role="img" aria-label={`${country} flag`}>{flag}</span>; }

function Sidebar() {
  return <aside className="sidebar models-sidebar">
    <a className="brand" href="/"><img src="/7035402.svg" alt="Leakporns logo" /><span>leak<b>porns</b></span></a>
    <nav className="primary-nav"><p>— Menu</p><a href="/"><NavIcon type="browse" />Browse</a><a href="/studio"><NavIcon type="studio" />Studio</a><a href="/chat"><NavIcon type="chat" />Chat</a><a href="/auth/sign-in"><NavIcon type="account" />Account</a></nav>
    <nav className="library-nav"><p>— Library</p><a href="/lists"><NavIcon type="lists" />My Lists</a><a className="selected" href="/models" aria-current="page"><NavIcon type="models" />Models</a><a href="/shop"><NavIcon type="shop" />Shop</a><a href="/rewards"><NavIcon type="rewards" />Rewards</a></nav>
    <div className="sidebar-tail"><button className="support" type="button"><span className="support-dot" />Support-Chat</button><button className="locale" type="button"><Flag /> English <Chevron /></button></div>
    <button className="balance" type="button" aria-label="Open balance details"><KeyIcon /><span>3</span><i /><PlusIcon /></button>
    <div className="account-chip"><span className="profile">LS</span><div><b>Sign in</b><small>Guest</small></div></div>
  </aside>;
}

async function loadModels(sort, offset = 0, query = '', filters = {}) {
  const params = new URLSearchParams({ sort, limit: '30', offset: String(offset) });
  if (query.trim()) params.set('query', query.trim());
  Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
  const response = await fetch(`${apiBase}/api/models?${params}`);
  if (!response.ok) throw new Error('Model catalogue is unavailable');
  return response.json();
}

function DropdownFilter({ label, value, placeholder, options, icon: Icon, open, onToggle, onSelect }) {
  const selected = options.find(option => option.value === value);
  return <div className="model-filter-control"><button className={`model-filter-button${value ? ' has-value' : ''}`} type="button" aria-expanded={open} aria-haspopup="listbox" onClick={onToggle}><Icon /><span>{selected?.label || placeholder}</span><Chevron /></button>{open && <div className="model-filter-menu" role="listbox" aria-label={label}>{options.map(option => <button key={option.value || 'all'} type="button" role="option" aria-selected={option.value === value} className={option.value === value ? 'active' : ''} onClick={() => onSelect(option.value)}>{option.label}{option.count ? <small>{option.count}</small> : null}</button>)}</div>}</div>;
}

export default function ModelsPage({ initialData = {}, initialFilterOptions = {} }) {
  const [creators, setCreators] = useState(() => initialData.items || []);
  const [total, setTotal] = useState(() => initialData.total || 0);
  const [saved, setSaved] = useState([]);
  const [showFilters, setShowFilters] = useState(() => Boolean(initialParam('ethnicity') || initialParam('country') || initialParam('tag') || initialParam('bodyType') || initialParam('cupSize')));
  const [openFilter, setOpenFilter] = useState(null);
  const [sort, setSort] = useState(initialSort);
  const [queryDraft, setQueryDraft] = useState(() => initialParam('query'));
  const [query, setQuery] = useState(() => initialParam('query'));
  const [ethnicity, setEthnicity] = useState(() => initialParam('ethnicity'));
  const [country, setCountry] = useState(() => initialParam('country'));
  const [tag, setTag] = useState(() => initialParam('tag'));
  const [bodyType, setBodyType] = useState(() => initialParam('bodyType'));
  const [cupSize, setCupSize] = useState(() => initialParam('cupSize'));
  const [filterOptions, setFilterOptions] = useState(() => ({ ...emptyOptions, ...initialFilterOptions }));
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const initialFetchSkipped = useRef(false);

  const activeFilters = { ethnicity, country, tag, bodyType, cupSize };
  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;
  const hasCriteria = Boolean(query.trim() || activeFilterCount);
  const filterOptionsWithAll = useMemo(() => ({
    ethnicity: ethnicities.map(([value, label]) => ({ value, label })),
    countries: [{ value: '', label: 'Select country' }, ...filterOptions.countries],
    tags: [{ value: '', label: 'Filter by tags' }, ...filterOptions.tags],
    bodyTypes: [{ value: '', label: 'Body Type' }, ...filterOptions.bodyTypes],
    cupSizes: [{ value: '', label: 'Cup Size' }, ...filterOptions.cupSizes],
  }), [filterOptions]);

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem('leakporns-saved-models') || '[]');
      if (Array.isArray(stored)) setSaved(stored);
    } catch { /* local storage is optional */ }
  }, []);
  useEffect(() => {
    try { window.localStorage.setItem('leakporns-saved-models', JSON.stringify(saved)); } catch { /* local storage is optional */ }
  }, [saved]);
  useEffect(() => {
    if (filterOptions.countries.length || filterOptions.bodyTypes.length || filterOptions.cupSizes.length || filterOptions.tags.length) return;
    fetch(`${apiBase}/api/model-filters`).then(response => response.ok ? response.json() : Promise.reject(new Error('Filter metadata unavailable'))).then(data => setFilterOptions({ ...emptyOptions, ...data })).catch(() => {});
  }, [filterOptions.bodyTypes.length, filterOptions.countries.length, filterOptions.cupSizes.length, filterOptions.tags.length]);
  useEffect(() => {
    if (!initialFetchSkipped.current && initialData.items?.length) {
      initialFetchSkipped.current = true;
      return;
    }
    initialFetchSkipped.current = true;
    let cancelled = false;
    setIsLoading(true);
    loadModels(sort, 0, query, activeFilters).then(data => {
      if (!cancelled) { setCreators(data.items); setTotal(data.total); }
    }).catch(() => {
      if (!cancelled) { setCreators([]); setTotal(0); }
    }).finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, query, ethnicity, country, tag, bodyType, cupSize]);
  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set('query', query);
    if (sort !== 'hot') params.set('sort', sort);
    Object.entries(activeFilters).forEach(([key, value]) => { if (value) params.set(key, value); });
    window.history.replaceState(null, '', params.toString() ? `/models?${params}` : '/models');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, sort, ethnicity, country, tag, bodyType, cupSize]);

  const chooseFilter = (key, value) => {
    const setters = { ethnicity: setEthnicity, country: setCountry, tag: setTag, bodyType: setBodyType, cupSize: setCupSize };
    setters[key](value);
    setOpenFilter(null);
  };
  const submitSearch = event => { event.preventDefault(); setQuery(queryDraft.trim()); };
  const clearFilters = () => { setEthnicity(''); setCountry(''); setTag(''); setBodyType(''); setCupSize(''); setSort('hot'); setOpenFilter(null); };
  const clearSearch = () => { setQueryDraft(''); setQuery(''); };
  const loadMore = async () => {
    setIsLoadingMore(true);
    try {
      const data = await loadModels(sort, creators.length, query, activeFilters);
      setCreators(current => [...current, ...data.items]);
      setTotal(data.total);
    } finally { setIsLoadingMore(false); }
  };
  const toggleSaved = id => setSaved(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const activeSort = sorts.find(([key]) => key === sort)?.[1] || 'Hot';

  return <div className="site-shell models-shell">
    <Sidebar />
    <MobileNav active="models" />
    <main className="models-main" id="main-content">
      <header className="models-header"><div><p className="eyebrow">— Models</p><h1>{total.toLocaleString()} <span>creators</span></h1></div><form className={`models-search${query ? ' has-query' : ''}`} onSubmit={submitSearch}><SearchIcon /><input value={queryDraft} onChange={event => setQueryDraft(event.target.value)} placeholder="Search models" aria-label="Search models" />{queryDraft && <button className="models-search-clear" type="button" onClick={clearSearch} aria-label="Clear model search"><CloseIcon /></button>}<button className="models-search-submit" type="submit">Search</button></form><div className="filter-control"><button className="filters-button" type="button" aria-expanded={showFilters} onClick={() => { setShowFilters(open => !open); setOpenFilter(null); }}><FilterIcon />Filters{activeFilterCount ? ` · ${activeFilterCount} active` : ''}</button></div></header>
      {showFilters && <section className="model-filter-panel" aria-label="Model filters"><div className="model-filter-row">
        <DropdownFilter label="Ethnicity" value={ethnicity} placeholder="Ethnicity" options={filterOptionsWithAll.ethnicity} icon={FilterIcon} open={openFilter === 'ethnicity'} onToggle={() => setOpenFilter(openFilter === 'ethnicity' ? null : 'ethnicity')} onSelect={value => chooseFilter('ethnicity', value)} />
        <DropdownFilter label="Country" value={country} placeholder="Select country" options={filterOptionsWithAll.countries} icon={GlobeIcon} open={openFilter === 'country'} onToggle={() => setOpenFilter(openFilter === 'country' ? null : 'country')} onSelect={value => chooseFilter('country', value)} />
        <DropdownFilter label="Tags" value={tag} placeholder="Filter by tags" options={filterOptionsWithAll.tags} icon={TagIcon} open={openFilter === 'tag'} onToggle={() => setOpenFilter(openFilter === 'tag' ? null : 'tag')} onSelect={value => chooseFilter('tag', value)} />
        <DropdownFilter label="Body Type" value={bodyType} placeholder="Body Type" options={filterOptionsWithAll.bodyTypes} icon={BodyIcon} open={openFilter === 'bodyType'} onToggle={() => setOpenFilter(openFilter === 'bodyType' ? null : 'bodyType')} onSelect={value => chooseFilter('bodyType', value)} />
        <DropdownFilter label="Cup Size" value={cupSize} placeholder="Cup Size" options={filterOptionsWithAll.cupSizes} icon={CupIcon} open={openFilter === 'cupSize'} onToggle={() => setOpenFilter(openFilter === 'cupSize' ? null : 'cupSize')} onSelect={value => chooseFilter('cupSize', value)} />
        <DropdownFilter label="Sort" value={sort} placeholder="Hot" options={sorts.map(([value, label]) => ({ value, label }))} icon={FlameIcon} open={openFilter === 'sort'} onToggle={() => setOpenFilter(openFilter === 'sort' ? null : 'sort')} onSelect={value => { setSort(value); setOpenFilter(null); }} />
        <button className="model-filter-clear" type="button" onClick={clearFilters} disabled={!activeFilterCount}>Clear</button>
      </div></section>}
      <p className="models-status" aria-live="polite">{isLoading ? 'Loading model catalogue…' : `${activeSort}${activeFilterCount ? ` · ${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} active` : ''}`}</p>
      <section className="creator-grid" aria-label="Creators">{creators.map((creator, index) => <article className="creator-card" key={creator.id}>
        <img src={creator.profileImageUrl || '/7035402.svg'} alt={`${creator.name} profile`} loading={index < 5 ? 'eager' : 'lazy'} />
        <div className="creator-shade" />
        <CountryFlag summary={creator.summaryDisplay} />
        <button className="bookmark" type="button" aria-label={`${saved.includes(creator.id) ? 'Remove' : 'Save'} ${creator.name}`} aria-pressed={saved.includes(creator.id)} onClick={() => toggleSaved(creator.id)}><BookmarkIcon filled={saved.includes(creator.id)} /></button>
        <a className="creator-copy" href={`/model/${encodeURIComponent(creator.slug)}`}><h2>{creator.name}</h2><p>{creator.sourceQuery ? `@${creator.sourceQuery.replace(/^@/, '')}` : ''}</p>{creator.summaryDisplay && <small>{creator.summaryDisplay.split('·').map((part, partIndex) => <span key={`${part}-${partIndex}`}>{part.trim()}{partIndex < creator.summaryDisplay.split('·').length - 1 && <i />}</span>)}</small>}</a>
      </article>)}</section>
      {!isLoading && !creators.length && <section className="empty-creators"><h2>No creators found</h2><p>Try another filter or clear the active filters.</p><button type="button" onClick={clearFilters}>Clear filters</button></section>}
      {creators.length < total && <button className="load-more" type="button" onClick={loadMore} disabled={isLoadingMore}>{isLoadingMore ? 'Loading…' : 'Load more'} <span>↓</span></button>}
    </main>
  </div>;
}
