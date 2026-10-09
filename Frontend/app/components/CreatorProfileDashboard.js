'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { DashboardBrand, DashboardIcon, DashboardSidebar } from './DreamDashboard';
import OpenLinkButton from './OpenLinkButton';
import styles from './DreamDashboard.module.css';

// Keep browser requests on the current origin. Next rewrites /api to the
// backend internally, so visitors never need a direct backend host.
const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
const tabs = [['all', 'All'], ['images', 'Photos'], ['videos', 'Videos'], ['trending', 'Trending']];
const sorts = [['recent', 'Recently updated'], ['media', 'Most media'], ['title', 'Title A–Z']];

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function count(value) {
  return Number(value || 0).toLocaleString();
}

function mediaCount(item) {
  return Number(item.images || 0) + Number(item.videos || 0);
}

function profileHandle(model) {
  const source = model?.sourceQuery || model?.name || '';
  return `@${source.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 28) || 'creator'}`;
}

function socialLabel(key, url) {
  const labels = { instagram: 'Instagram', twitter: 'X / Twitter', tiktok: 'TikTok', onlyfans: 'OnlyFans', reddit: 'Reddit', youtube: 'YouTube', linktree: 'Linktree' };
  if (labels[String(key).toLowerCase()]) return labels[String(key).toLowerCase()];
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return String(key || 'Social'); }
}

function dateLabel(value) {
  if (!value) return 'Recently updated';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return 'Recently updated';
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function storageList(key) {
  try {
    const stored = JSON.parse(window.localStorage.getItem(key) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch { return []; }
}

function LoadingProfile() {
  return <div className={styles.profileLoading} aria-label="Loading creator profile"><div /><div /><div /></div>;
}

function ContentPreview({ item, onClose }) {
  if (!item) return null;
  return <div className={styles.previewLayer} role="presentation" onClick={onClose}>
    <section className={styles.mediaDialog} role="dialog" aria-modal="true" aria-labelledby="collection-preview-title" onClick={event => event.stopPropagation()}>
      <button className={styles.dialogClose} type="button" onClick={onClose} aria-label="Close collection preview"><DashboardIcon name="close" /></button>
      <div className={styles.mediaDialogVisual}>{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <div className={styles.mediaFallback}><DashboardIcon name="image" size={35} /></div>}{item.isPremium && <span className={styles.mediaPremium}>Premium</span>}</div>
      <div className={styles.mediaDialogCopy}><span>{item.isTrending ? 'TRENDING COLLECTION' : 'COLLECTION'}</span><h2 id="collection-preview-title">{item.title || 'Untitled collection'}</h2><p>{item.relativeAge || dateLabel(item.createdAt)} · {Number(item.images || 0)} photos · {Number(item.videos || 0)} videos</p><dl><div><small>Size</small><strong>{item.sizeDisplay || '—'}</strong></div><div><small>Content</small><strong>{count(mediaCount(item))} items</strong></div></dl><div className={styles.mediaDialogActions}><OpenLinkButton className={styles.mediaPrimaryLink} contentId={item.contentId || item.id}>Open link <DashboardIcon name="arrow" size={16} /></OpenLinkButton><button type="button" onClick={onClose}>Close preview</button></div></div>
    </section>
  </div>;
}

function CollectionCard({ item, saved, onSave, onPreview, eager = false }) {
  const label = item.title || 'Untitled collection';
  return <article className={styles.collectionCard}>
    <button type="button" className={styles.collectionImage} onClick={() => onPreview(item)} aria-label={`Preview ${label}`}>
      {item.imageUrl ? <img src={item.imageUrl} alt="" loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : 'auto'} decoding="async" /> : <span className={styles.collectionFallback}><DashboardIcon name="image" size={26} /></span>}
      <span className={styles.collectionShade} />
      {item.isTrending && <span className={styles.collectionBadge}>Trending</span>}
      {item.isPremium && <span className={styles.premiumRibbon}><DashboardIcon name="crown" size={13} />Premium</span>}
      <span className={styles.collectionExpand}><DashboardIcon name="search" size={16} /></span>
    </button>
    <div className={styles.collectionBody}>
      <h3 title={label}>{label}</h3>
      <p><span>{Number(item.images || 0)} photos</span><span>{Number(item.videos || 0)} videos</span>{item.sizeDisplay && <span>{item.sizeDisplay}</span>}</p>
      <small><DashboardIcon name="clock" size={13} />{item.relativeAge || dateLabel(item.createdAt)}</small>
      <div className={styles.collectionActions}><OpenLinkButton className={styles.collectionOpenLink} contentId={item.contentId || item.id}>Open link <DashboardIcon name="arrow" size={14} /></OpenLinkButton><button type="button" className={styles.collectionSave} aria-label={`${saved ? 'Remove' : 'Save'} ${label}`} aria-pressed={saved} onClick={() => onSave(item.id || item.shortCode || label)}><DashboardIcon name="bookmark" size={16} className={saved ? styles.savedIcon : ''} /></button></div>
    </div>
  </article>;
}

export function CreatorProfileDashboard({ slug, initialModel = null }) {
  const [model, setModel] = useState(initialModel);
  const [loading, setLoading] = useState(!initialModel);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('all');
  const [sort, setSort] = useState('recent');
  const [visible, setVisible] = useState(12);
  const [savedCreators, setSavedCreators] = useState([]);
  const [savedCollections, setSavedCollections] = useState([]);
  const [bioOpen, setBioOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setModel(initialModel);
    setLoading(!initialModel);
    setError('');
  }, [initialModel, slug]);

  useEffect(() => {
    if (initialModel?.slug === slug) return undefined;
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${apiBase}/api/models/${encodeURIComponent(slug)}?limit=60`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(6000)]) });
        if (!response.ok) throw new Error('The creator profile is unavailable.');
        setModel(await response.json());
      } catch (requestError) {
        if (requestError.name !== 'AbortError') setError('This creator profile could not be loaded.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    };
    load();
    return () => controller.abort();
  }, [initialModel?.slug, retryKey, slug]);

  useEffect(() => {
    if (!preview) return undefined;
    const closeOnEscape = event => { if (event.key === 'Escape') setPreview(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [preview]);

  useEffect(() => {
    setSavedCreators(storageList('dreamproject-saved-creators'));
    setSavedCollections(storageList('dreamproject-saved-collections'));
  }, []);
  useEffect(() => { try { window.localStorage.setItem('dreamproject-saved-creators', JSON.stringify(savedCreators)); } catch { /* storage is optional */ } }, [savedCreators]);
  useEffect(() => { try { window.localStorage.setItem('dreamproject-saved-collections', JSON.stringify(savedCollections)); } catch { /* storage is optional */ } }, [savedCollections]);
  useEffect(() => { setVisible(12); }, [query, tab, sort]);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const links = asList(model?.openLinks);
  const filteredLinks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = links.filter(item => {
      const searchable = `${item.title || ''} ${item.shortCode || ''}`.toLowerCase();
      if (needle && !searchable.includes(needle)) return false;
      if (tab === 'images') return Number(item.images || 0) > 0;
      if (tab === 'videos') return Number(item.videos || 0) > 0;
      if (tab === 'trending') return Boolean(item.isTrending);
      return true;
    });
    return matches.sort((left, right) => {
      if (sort === 'media') return mediaCount(right) - mediaCount(left);
      if (sort === 'title') return String(left.title || '').localeCompare(String(right.title || ''));
      return new Date(right.createdAt || 0).valueOf() - new Date(left.createdAt || 0).valueOf();
    });
  }, [links, query, sort, tab]);

  const profileMeta = Object.entries(model?.profileMeta || {}).filter(([, value]) => value !== null && value !== undefined && value !== '');
  const socialLinks = Object.entries(model?.socialLinks || {}).filter(([, url]) => typeof url === 'string' && /^https?:\/\//i.test(url));
  const creatorSaved = model && savedCreators.includes(model.id);
  const summary = model?.bio || model?.summaryDisplay || 'This profile has no bio yet. Browse the available collections below.';
  const stats = [{ label: 'Open links', value: model?.openLinkCount || links.length, icon: 'database' }, { label: 'Trending', value: model?.trendingCount || links.filter(item => item.isTrending).length, icon: 'spark' }, { label: 'Photos', value: links.reduce((total, item) => total + Number(item.images || 0), 0), icon: 'image' }, { label: 'Videos', value: links.reduce((total, item) => total + Number(item.videos || 0), 0), icon: 'video' }];
  const toggleCreator = () => {
    if (!model) return;
    setSavedCreators(items => items.includes(model.id) ? items.filter(item => item !== model.id) : [...items, model.id]);
    setNotice(creatorSaved ? 'Creator removed from saved.' : 'Creator saved.');
  };
  const toggleCollection = id => setSavedCollections(items => items.includes(id) ? items.filter(item => item !== id) : [...items, id]);

  return <div className={styles.dashboard}>
    <DashboardSidebar active="Creators" savedCount={savedCreators.length} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} onUnavailable={setNotice} />
    <main className={`${styles.main} ${styles.profileMain}`}>
      <div className={styles.backGlow} />
      <header className={styles.mobileHeader}><DashboardBrand /><button type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><DashboardIcon name="menu" /></button></header>
      <section className={styles.profileToolbar} aria-label="Creator profile controls"><Link className={styles.backCreators} href="/creators"><DashboardIcon name="arrow" size={16} />All creators</Link><form className={styles.profileSearch} onSubmit={event => event.preventDefault()}><DashboardIcon name="search" /><label className={styles.srOnly} htmlFor="creator-content-search">Search this creator&apos;s content</label><input id="creator-content-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search this creator's content" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear creator content search"><DashboardIcon name="close" size={15} /></button>}</form><button className={styles.profileFilterButton} type="button" onClick={() => setTab(tab === 'trending' ? 'all' : 'trending')} aria-pressed={tab === 'trending'}><DashboardIcon name="filter" size={16} /><span>{tab === 'trending' ? 'Trending on' : 'Filter'}</span></button></section>
      {loading ? <LoadingProfile /> : error || !model ? <section className={styles.profileEmpty}><DashboardIcon name="user" size={29} /><h1>Creator unavailable</h1><p>{error || 'The requested creator profile could not be found.'}</p><div><button type="button" onClick={() => { setError(''); setLoading(true); setRetryKey(value => value + 1); }}>Try again</button><Link href="/creators">Back to creators</Link></div></section> : <>
        <section className={styles.profileBreadcrumb}><span>CREATOR PROFILE</span><span aria-hidden="true">/</span><strong>{model.name}</strong></section>
        <div className={styles.profileLayout}>
          <aside className={styles.profilePanel}>
            <div className={styles.profileHero}>{model.profileImageUrl ? <img src={model.profileImageUrl} alt={`${model.name} profile`} /> : <div className={styles.profileHeroFallback}>{model.name?.slice(0, 1)}</div>}<span className={styles.profileHeroShade} />{model.isComplete && <span className={styles.profileState}><DashboardIcon name="check" size={13} />Profile ready</span>}<div className={styles.profileIdentity}><h1>{model.name}</h1><p>{profileHandle(model)}</p></div></div>
            <div className={styles.profileActionRow}><button type="button" className={creatorSaved ? styles.profileSaved : ''} aria-pressed={creatorSaved} onClick={toggleCreator}><DashboardIcon name="bookmark" size={16} className={creatorSaved ? styles.savedIcon : ''} />{creatorSaved ? 'Saved creator' : 'Save creator'}</button><button type="button" aria-label="Share this creator" onClick={() => { navigator.clipboard?.writeText(window.location.href); setNotice('Profile link copied.'); }}><DashboardIcon name="arrow" size={17} /></button></div>
            <dl className={styles.profileStats}>{stats.map(stat => <div key={stat.label}><DashboardIcon name={stat.icon} size={15} /><dd>{count(stat.value)}</dd><dt>{stat.label}</dt></div>)}</dl>
            <section className={styles.profileSection}><p className={styles.profileEyebrow}>ABOUT</p><div className={`${styles.profileBio}${bioOpen ? ` ${styles.profileBioOpen}` : ''}`}><p>{summary}</p></div>{summary.length > 170 && <button className={styles.showBio} type="button" onClick={() => setBioOpen(value => !value)}>{bioOpen ? 'Show less' : 'Read more'} <DashboardIcon name="chevron" className={bioOpen ? styles.rotated : ''} size={15} /></button>}</section>
            {socialLinks.length > 0 && <section className={styles.profileSection}><p className={styles.profileEyebrow}>SOCIALS</p><div className={styles.socialLinks}>{socialLinks.map(([key, url]) => <a key={`${key}-${url}`} href={url} target="_blank" rel="noreferrer"><span>{socialLabel(key, url)}</span><DashboardIcon name="arrow" size={14} /></a>)}</div></section>}
            {asList(model.tags).length > 0 && <section className={styles.profileSection}><p className={styles.profileEyebrow}>TAGS</p><div className={styles.profileTags}>{asList(model.tags).map(tag => <span key={tag.code || tag.label}>{tag.label || tag.code}</span>)}</div></section>}
            {profileMeta.length > 0 && <section className={styles.profileSection}><p className={styles.profileEyebrow}>DETAILS</p><dl className={styles.profileDetails}>{profileMeta.slice(0, 8).map(([key, value]) => <div key={key}><dt>{String(key).replace(/([A-Z])/g, ' $1')}</dt><dd>{Array.isArray(value) ? value.join(', ') : String(value)}</dd></div>)}</dl></section>}
          </aside>
          <section className={styles.profileContent}>
            <header className={styles.contentHeading}><div><p>COLLECTIONS</p><h2>{model.name}&apos;s content</h2><span>Browse available collections and recently updated content.</span></div><small>{count(filteredLinks.length)} available</small></header>
            <div className={styles.contentControls}><div className={styles.profileTabs} role="tablist" aria-label="Content type">{tabs.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? styles.profileTabActive : ''} onClick={() => setTab(key)}>{label}</button>)}</div><label className={styles.profileSortLabel}>Sort <select value={sort} onChange={event => setSort(event.target.value)}>{sorts.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
            {filteredLinks.length ? <><div className={styles.collectionGrid}>{filteredLinks.slice(0, visible).map((item, index) => <CollectionCard key={item.id || item.shortCode || item.title} item={item} eager={index === 0} saved={savedCollections.includes(item.id || item.shortCode || item.title)} onSave={toggleCollection} onPreview={setPreview} />)}</div>{visible < filteredLinks.length && <button className={styles.loadMore} type="button" onClick={() => setVisible(value => value + 12)}>Load more collections <DashboardIcon name="arrow" size={16} /></button>}</> : <section className={styles.profileContentEmpty}><DashboardIcon name="search" size={25} /><h3>No matching collections</h3><p>Try another search term or choose a different content type.</p><button type="button" onClick={() => { setQuery(''); setTab('all'); }}>Clear filters</button></section>}
          </section>
        </div>
      </>}
    </main>
    <nav className={styles.bottomNav} aria-label="Mobile navigation"><Link href="/discover"><DashboardIcon name="compass" /><span>Home</span></Link><Link href="/creators" className={styles.bottomActive}><DashboardIcon name="grid" /><span>Explore</span></Link><button type="button" onClick={toggleCreator} aria-pressed={creatorSaved}><DashboardIcon name="bookmark" className={creatorSaved ? styles.savedIcon : ''} /><span>Saved</span></button><Link href="/upgrade"><DashboardIcon name="crown" /><span>Upgrade</span></Link></nav>
    <ContentPreview item={preview} onClose={() => setPreview(null)} />
    {notice && <div className={styles.toast} role="status"><DashboardIcon name="info" size={16} />{notice}</div>}
  </div>;
}
