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
  return <aside className="sidebar detail-sidebar"><a className="brand" href="/"><img src="/7035402.svg" alt="Leakporns logo" /><span>leak<b>porns</b></span></a><nav className="primary-nav"><p>— Menu</p>{row('/', 'browse', 'Browse')}{row('/studio', 'studio', 'Studio')}{row('/chat', 'chat', 'Chat')}{row('/auth/sign-in', 'account', 'Account')}</nav><nav className="library-nav"><p>— Library</p>{row('/lists', 'lists', 'My Lists')}{row('/models', 'models', 'Models', true)}{row('/shop', 'shop', 'Shop')}{row('/rewards', 'rewards', 'Rewards')}</nav><div className="sidebar-tail"><button className="support" type="button"><span className="support-dot" />Support-Chat</button><button className="locale" type="button"><Flag /> English <span>⌄</span></button></div><button className="balance" type="button" aria-label="Open balance details"><Icon name="key" /><span>3</span><i /><Icon name="plus" /></button><a className="account-chip" href="/auth/sign-in"><span className="profile">LP</span><div><b>Sign in</b><small>Guest</small></div></a></aside>;
}

function stats(link) { return [link.sizeDisplay || '—', `${link.images || 0} imgs`, `${link.videos || 0} videos`, link.relativeAge].filter(Boolean).join(' · '); }
function profileSlug(value = '') { return decodeURIComponent(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }
const metaOrder = ['aliases', 'born', 'age', 'race', 'hair', 'eyes', 'body', 'chest', 'height', 'weight', 'orient.'];
const metaLabels = { aliases: 'Aliases', born: 'Born', age: 'Age', race: 'Race', hair: 'Hair', eyes: 'Eyes', body: 'Body', chest: 'Cup size', height: 'Height', weight: 'Weight', 'orient.': 'Orientation' };
const socialLabels = { instagram: 'Instagram', tiktok: 'TikTok', onlyfans: 'OnlyFans', 'of free': 'OF Free', fansly: 'Fansly', twitter: 'X / Twitter', x: 'X' };
const socialOrder = ['instagram', 'tiktok', 'onlyfans', 'of free', 'fansly'];
const tagOrder = ['PROFESSION_MODEL', 'PROFESSION_COSPLAYER', 'PROFESSION_GAMER', 'PROFESSION_SEX_THERAPIST', 'CATEGORY_MASTURBATION', 'CATEGORY_DILDO', 'CATEGORY_DILDO_BLOWJOB', 'CATEGORY_BLOWJOB', 'CATEGORY_VAGINAL', 'CATEGORY_ANAL', 'CATEGORY_CREAMPIE', 'CATEGORY_INTERRACIAL', 'CATEGORY_FAN_FUCK'];
function countryEmoji(summary = '') {
  const code = summary.match(/\b([A-Z]{2})\b/)?.[1] || '';
  return code.length === 2 ? String.fromCodePoint(...[...code].map(letter => 127397 + letter.charCodeAt(0))) : '';
}
function CountryFlag({ summary }) {
  const flag = countryEmoji(summary);
  return flag ? <span className="profile-country-flag" role="img" aria-label={`${summary.match(/\b([A-Z]{2})\b/)?.[1]} flag`}>{flag}</span> : null;
}
function socialLabel(key) { return socialLabels[key.toLowerCase()] || key.replace(/\b\w/g, letter => letter.toUpperCase()); }
function orderedSocialLinks(socialLinks = {}) {
  const keys = Object.keys(socialLinks);
  return [...socialOrder.filter(key => socialLinks[key]), ...keys.filter(key => !socialOrder.includes(key))].map(key => [key, socialLinks[key]]);
}
function orderedTags(tags = []) {
  return [...tags].sort((left, right) => {
    const leftIndex = tagOrder.indexOf(left.code);
    const rightIndex = tagOrder.indexOf(right.code);
    if (leftIndex !== -1 || rightIndex !== -1) return (leftIndex === -1 ? tagOrder.length : leftIndex) - (rightIndex === -1 ? tagOrder.length : rightIndex);
    return left.label.localeCompare(right.label);
  });
}

export default function ModelDetailPage({ initialModel = null }) {
  const params = useParams();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const lookupSlug = profileSlug(slug);
  const [model, setModel] = useState(initialModel);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [selectedLink, setSelectedLink] = useState(null);
  const [shareStatus, setShareStatus] = useState('');

  useEffect(() => {
    if (initialModel && profileSlug(initialModel.slug || initialModel.name) === lookupSlug) return;
    const controller = new AbortController();
    fetch(`${apiBase}/api/models/${encodeURIComponent(lookupSlug)}?limit=24`, { signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject(new Error(response.status === 404 ? 'This profile has not been imported yet.' : 'Profile unavailable.')))
      .then(setModel)
      .catch(fetchError => { if (fetchError.name !== 'AbortError') setError(fetchError.message); });
    return () => controller.abort();
  }, [initialModel, lookupSlug]);
  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem('leakporns-saved-models') || '[]');
      setSaved(Array.isArray(stored) && stored.includes(lookupSlug));
    } catch { /* local storage is optional */ }
  }, [lookupSlug]);

  const toggleSaved = () => {
    setSaved(value => {
      try {
        const stored = JSON.parse(window.localStorage.getItem('leakporns-saved-models') || '[]');
        const next = value ? stored.filter(item => item !== lookupSlug) : [...new Set([...stored, lookupSlug])];
        window.localStorage.setItem('leakporns-saved-models', JSON.stringify(next));
      } catch { /* local storage is optional */ }
      return !value;
    });
  };

  const shareProfile = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: model?.name || 'Leakporns profile', url });
      else await navigator.clipboard.writeText(url);
      setShareStatus(navigator.share ? 'Shared' : 'Link copied');
    } catch { setShareStatus('Share cancelled'); }
    window.setTimeout(() => setShareStatus(''), 2200);
  };

  return <div className="site-shell detail-shell">
    <DetailSidebar /><MobileNav active="models" />
    <main className="detail-main">
      <header className="detail-top"><form className="detail-search" action="/models"><span><Icon name="search" /></span><input name="query" defaultValue={model?.name || ''} placeholder="Search models" aria-label="Search models" /><button type="submit" aria-label="Search visually"><Icon name="scan" /></button><i /><b><Icon name="clock" /> New</b></form><a className="detail-models-link" href="/models"><Icon name="users" />Models</a></header>
      {error && <section className="detail-message"><h1>Model catalogue is ready to connect</h1><p>{error} Run the backend migration and importer, then reload this profile.</p><a href="/models">Return to models</a></section>}
      {!model && !error && <section className="detail-message"><p>Loading creator profile…</p></section>}
      {model && <section className="detail-layout">
        <aside className="profile-column">
          <article className="profile-hero"><img src={model.profileImageUrl || '/7035402.svg'} alt={`${model.name} profile`} loading="eager" fetchPriority="high" decoding="async" /><div /><h1>{model.name}</h1><p><CountryFlag summary={model.summaryDisplay} />{model.summaryDisplay}</p></article>
          <div className="profile-actions"><button type="button" aria-pressed={saved} aria-label={saved ? 'Remove saved profile' : 'Save profile'} onClick={toggleSaved}><Icon name="bookmark" /></button><button type="button" onClick={shareProfile}><Icon name="share" />Share</button><a href="/models"><Icon name="grid" />All Models</a>{shareStatus && <span className="share-status" aria-live="polite">{shareStatus}</span>}</div>
          <section className="profile-bio">
            <section className="profile-section"><p className="eyebrow">— Bio</p><p>{model.bio || 'No biography is available for this creator yet.'}</p></section>
            {Object.keys(model.socialLinks || {}).length > 0 && <section className="profile-section profile-social"><p className="eyebrow">— Social links</p><div>{orderedSocialLinks(model.socialLinks).map(([key, value]) => <a key={key} href={value} target="_blank" rel="noreferrer"><span>{socialLabel(key)}</span><small>{value.replace(/^https?:\/\//, '').replace(/\/$/, '')}</small></a>)}</div></section>}
            {model.tags?.length > 0 && <section className="profile-section profile-tags"><p className="eyebrow">— Tags</p><div>{orderedTags(model.tags).map(tag => <a key={tag.code} href={`/models?tag=${encodeURIComponent(tag.code)}`}>#{tag.label}</a>)}</div></section>}
            {Object.keys(model.profileMeta || {}).length > 0 && <section className="profile-section profile-meta"><p className="eyebrow">— Meta</p><div>{metaOrder.filter(key => model.profileMeta[key]).concat(Object.keys(model.profileMeta || {}).filter(key => !metaOrder.includes(key))).map(key => <span key={key}><b>{metaLabels[key] || key}</b><strong>{model.profileMeta[key]}</strong></span>)}</div></section>}
          </section>
        </aside>
        <section className="detail-media" aria-label={`${model.name} open links`}>{model.openLinks.map((link, index) => { const openHref = link.megaUrl || '/models'; return <article className="detail-media-card" key={`${link.contentId}-${link.position}`}><img src={link.imageUrl || '/7035402.svg'} alt={link.title} loading={index === 0 ? 'eager' : 'lazy'} fetchPriority={index === 0 ? 'high' : 'auto'} decoding="async" />{link.isTrending && <span className="trending">Trending</span>}<button type="button" className="card-more" aria-label={`More actions for ${link.title}`} onClick={() => setSelectedLink(link)}><Icon name="more" /></button><div className="detail-card-copy"><h2>{link.title}</h2><p>{stats(link)}</p><div><a href={openHref} target={link.megaUrl ? '_blank' : undefined} rel={link.megaUrl ? 'noreferrer' : undefined}><Icon name="link" />Open Link</a><button type="button" aria-label={`Add ${link.title}`} onClick={() => setSelectedLink(link)}><Icon name="plus" /></button></div></div></article>; })}</section>
      </section>}
    </main>
    {selectedLink && <div className="info-layer" role="presentation" onClick={() => setSelectedLink(null)}><section className="info-dialog" role="dialog" aria-modal="true" aria-labelledby="detail-link-title" onClick={event => event.stopPropagation()}><button className="dialog-close" type="button" aria-label="Close details" onClick={() => setSelectedLink(null)}>×</button><p className="eyebrow">— Open link</p><h2 id="detail-link-title">{selectedLink.title}</h2><p className="info-model">{model.name}</p><dl><div><dt>Images</dt><dd>{selectedLink.images || 0}</dd></div><div><dt>Videos</dt><dd>{selectedLink.videos || 0}</dd></div><div><dt>Size</dt><dd>{selectedLink.sizeDisplay || '—'}</dd></div></dl><div className="info-actions"><a href={selectedLink.megaUrl || '/models'} target={selectedLink.megaUrl ? '_blank' : undefined} rel={selectedLink.megaUrl ? 'noreferrer' : undefined}>Open link</a></div></section></div>}
  </div>;
}
