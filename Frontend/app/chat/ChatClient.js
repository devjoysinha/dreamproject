'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DashboardSidebar, DashboardIcon } from '../components/DreamDashboard';
import styles from './Chat.module.css';

const apiBase = process.env.NEXT_PUBLIC_API_URL || '';

function CharacterCard({ character }) {
  const tagColors = ['#7c5cfc', '#21d4fd', '#a48bff', '#7de3ff'];
  return (
    <Link href={`/chat/${character.slug}`} className={styles.characterCard}>
      <div className={styles.characterMedia}>
        {character.imageUrl ? (
          <img src={character.imageUrl} alt={character.name} loading="lazy" />
        ) : (
          <div className={styles.characterFallback}>
            <span>{character.name.split(' ').map(w => w[0]).join('')}</span>
          </div>
        )}
        <span className={styles.characterShade} />
        <span className={styles.levelBadge}>LV {character.level}</span>
        <div className={styles.characterIdentity}>
          <strong>{character.name}</strong>
          <small>{character.tagline}</small>
        </div>
      </div>
      <div className={styles.characterTags}>
        {(character.tags || []).slice(0, 4).map((tag, i) => (
          <span key={tag} style={{ borderColor: `${tagColors[i % tagColors.length]}44` }}>
            {tag}
          </span>
        ))}
      </div>
    </Link>
  );
}

export default function ChatClient() {
  const [characters, setCharacters] = useState([]);
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(`${apiBase}/api/chat/characters?category=${category}`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : { items: [] })
      .then(data => { setCharacters(data.items || []); setLoading(false); })
      .catch(err => { if (err.name !== 'AbortError') { setNotice('Could not load characters.'); setLoading(false); } });
    return () => controller.abort();
  }, [category]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 3200);
    return () => clearTimeout(t);
  }, [notice]);

  const categories = [
    ['all', 'All'],
    ['hot', 'Hot'],
    ['featured', 'Featured'],
    ['new', 'New'],
  ];

  return (
    <div className={styles.dashboard}>
      <DashboardSidebar active="Chat" savedCount={0} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} onUnavailable={setNotice} />
      <main className={styles.main}>
        <div className={styles.backGlow} />
        <header className={styles.mobileHeader}>
          <Link href="/" className={styles.brand}>
            <img className={styles.brandLogo} src="/7035402.svg" alt="LeakPorns" />
            <span>Leak<span>Porns</span></span>
          </Link>
          <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <DashboardIcon name="menu" />
          </button>
        </header>

        <section className={styles.heading}>
          <div>
            <p>— AI COMPANIONS</p>
            <h1>AI Companions</h1>
            <span>Chat, flirt, have fun — she remembers everything. Free to start.</span>
          </div>
        </section>

        <div className={styles.chips}>
          {categories.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={category === value ? styles.selectedChip : ''}
              onClick={() => setCategory(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className={styles.skeletonGrid}>
            {Array.from({ length: 8 }, (_, i) => <div key={i} />)}
          </div>
        ) : characters.length ? (
          <section className={styles.characterGrid}>
            {characters.map(c => <CharacterCard key={c.id} character={c} />)}
          </section>
        ) : (
          <section className={styles.empty}>
            <DashboardIcon name="message" size={28} />
            <h2>No companions found</h2>
            <p>Try a different category.</p>
          </section>
        )}
      </main>

      <nav className={styles.bottomNav}>
        <Link href="/discover"><DashboardIcon name="compass" /><span>Home</span></Link>
        <Link href="/creators"><DashboardIcon name="grid" /><span>Explore</span></Link>
        <button type="button" onClick={() => setNotice('Studio is coming soon.')}><DashboardIcon name="wand" /><span>Studio</span></button>
        <Link href="/chat" className={styles.bottomActive}><DashboardIcon name="message" /><span>Chat</span></Link>
        <Link href="/auth/sign-in"><DashboardIcon name="user" /><span>Profile</span></Link>
      </nav>

      {notice && <div className={styles.toast} role="status"><DashboardIcon name="info" size={16} />{notice}</div>}
    </div>
  );
}
