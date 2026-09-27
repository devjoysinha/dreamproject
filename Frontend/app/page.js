'use client';

import { useState } from 'react';
import content from '../content.json';

const formatSize = bytes => {
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1_000))} KB`;
  if (bytes < 1_000_000_000) return `${Math.max(1, Math.round(bytes / 1_000_000))} MB`;
  return `${Math.max(1, Math.round(bytes / 1_000_000_000))} GB`;
};
const relativeTime = date => {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(date).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  if (minutes < 1440) { const hours = Math.round(minutes / 60); return `${hours} hour${hours === 1 ? '' : 's'} ago`; }
  const days = Math.round(minutes / 1440); return `${days} day${days === 1 ? '' : 's'} ago`;
};

function NavIcon({ type }) {
  const paths = { browse: 'M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v6H4zM14 15h6v6h-6z', studio: 'M4 18 12 4l8 14H4Zm8-9v5m0 3h.01', chat: 'M5 5h14v11H9l-4 4V5Z', account: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9c.8-4.1 3.1-6 7-6s6.2 1.9 7 6', lists: 'M7 5h13M7 12h13M7 19h13M3 5h.01M3 12h.01M3 19h.01', models: 'M12 3 4 7v5c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V7l-8-4Z', shop: 'M4 9h16l-1 12H5L4 9Zm3 0a5 5 0 0 1 10 0', rewards: 'm12 3 2.4 5 5.6.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.6-.8L12 3Z' };
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[type]} /></svg>;
}
function SearchIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>; }
function Chevron() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>; }
function ClockIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>; }
function ScanEyeIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3m13 5h3a2 2 0 0 0 2-2v-3"/><path d="M6.5 12s2-3 5.5-3 5.5 3 5.5 3-2 3-5.5 3-5.5-3-5.5-3Z"/><circle cx="12" cy="12" r="1.5"/></svg>; }
function UsersIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.4-4 2.2-6 5.5-6s5.1 2 5.5 6M15 5.5a3 3 0 0 1 0 5.5m1.5 2.5c2.5.4 3.8 2.2 4 5.5"/></svg>; }
function KeyIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="12" r="4"/><path d="M12 12h9m-3 0v3m-3-3v2"/></svg>; }
function Flag() { return <svg className="flag" viewBox="0 0 24 16" aria-hidden="true"><rect width="24" height="16" rx="2" fill="#173b73"/><path d="M0 0 24 16M24 0 0 16" stroke="#fff" strokeWidth="4"/><path d="M0 0 24 16M24 0 0 16" stroke="#c7353b" strokeWidth="1.5"/><path d="M12 0v16M0 8h24" stroke="#fff" strokeWidth="5"/><path d="M12 0v16M0 8h24" stroke="#c7353b" strokeWidth="2"/></svg>; }
function LinkIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M9 12h6m-3-3 3 3-3 3"/></svg>; }
function PlusIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14"/></svg>; }
function InfoIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></svg>; }
function MoreIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.1"/><circle cx="12" cy="12" r="1.1"/><circle cx="19" cy="12" r="1.1"/></svg>; }

export default function Home() {
  const [ageOpen, setAgeOpen] = useState(true);
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(12);
  const list = content.items.filter(item => !item.deleted && item.title.toLowerCase().includes(query.toLowerCase()));
  const visibleList = list.slice(0, visibleCount);
  return <div className="site-shell">
    <aside className="sidebar">
      <a className="brand" href="#top"><img src="https://leakshaven.com/images/logo.svg" alt=""/><span>leaks<b>haven</b></span></a>
      <nav className="primary-nav"><p>— Menu</p><a className="selected" href="#top"><NavIcon type="browse"/>Browse</a><a href="#studio"><NavIcon type="studio"/>Studio</a><a href="#chat"><NavIcon type="chat"/>Chat</a><a href="#account"><NavIcon type="account"/>Account</a></nav>
      <nav className="library-nav"><p>— Library</p><a href="#lists"><NavIcon type="lists"/>My Lists</a><a href="/models"><NavIcon type="models"/>Models</a><a href="#shop"><NavIcon type="shop"/>Shop</a><a href="#rewards"><NavIcon type="rewards"/>Rewards</a></nav>
      <div className="sidebar-tail"><button className="support"><span className="support-dot"/>Support-Chat</button><button className="locale"><Flag/> English <Chevron/></button></div>
      <button className="balance" aria-label="Open balance details"><KeyIcon/><span>2</span><i/><PlusIcon/></button>
      <div className="account-chip"><span className="notice">3</span><span className="profile">LS</span><div><b>Sign in</b><small>Guest</small></div></div>
    </aside>
    <main id="top" className="main-content">
      <section className="top-strip">
        <div className="search-panel"><div className="search-row"><div className="search-input"><span className="search-icon-box"><SearchIcon/></span><input value={query} onChange={e => { setQuery(e.target.value); setVisibleCount(12); }} placeholder="Search & Filter" aria-label="Search and filter"/><a className="visual-search" href="#visual-search" aria-label="Visual search"><ScanEyeIcon/></a></div><button className="sort" aria-label="Sort results"><ClockIcon/><span>New</span><Chevron/></button></div></div>
        <a className="models-link" href="/models"><UsersIcon/>Models</a>
      </section>
      <section id="models" className="cards-wrap"><div className="cards-grid">{visibleList.map(item => <article className="media-card" key={item.id}>
        <div className="warm-glow"/><div className="media-frame"><button className="media-open" aria-label={item.title}><img src={item.previewMedia || item.media} alt={item.title}/></button>{item.isTrending && <span className="trending">Trending</span>}<button className="card-more" aria-label="More actions"><MoreIcon/></button></div>
        <div className="card-details"><h3 title={item.title}>{item.title}</h3><div className="metadata"><span>{formatSize(item.info.size)}</span><i>·</i><span>{item.info.images} imgs</span><i>·</i><span>{item.info.videos} videos</span><i>·</i><span>{relativeTime(item.createdAt)}</span><button className="info" aria-label="View details"><InfoIcon/></button></div><div className="card-cta"><button className="open-link" type="button"><LinkIcon/>Open Link</button><button className="more" aria-label="More"><PlusIcon/></button></div></div>
      </article>)}</div></section>
      {visibleCount < list.length && <button className="load-more" onClick={() => setVisibleCount(count => Math.min(count + 12, list.length))}>Load More <span>↓</span></button>}
    </main>
    {ageOpen && <div className="age-layer"><div className="age-dialog" role="dialog" aria-modal="true" aria-labelledby="age-title"><button className="age-close" onClick={() => setAgeOpen(false)} aria-label="Close">×</button><div className="age-copy"><h2 id="age-title">This site is for <em>adults only!</em></h2></div><p className="age-description">By entering this website, I acknowledge that I am <b>18 years or older</b> and agree to the <a href="#terms"> Terms of Service </a></p><div className="age-actions"><button className="age-language"><Flag/> English <Chevron/></button><a href="#login" className="age-login">↪ <span>Login</span></a><button className="age-confirm" onClick={() => setAgeOpen(false)}>I am 18 or older</button></div></div></div>}
  </div>;
}
