'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DashboardSidebar, DashboardIcon } from '../components/DreamDashboard';
import styles from './Studio.module.css';

const apiBase = process.env.NEXT_PUBLIC_API_URL || '';

const categoryLabels = { all: 'All', popular: 'Popular', image: 'Image', new: 'New' };

function PresetCard({ preset }) {
  const initials = preset.name.split(' ').map(w => w[0]).join('').slice(0, 2);
  return (
    <Link href={`/studio/${preset.slug}`} className={styles.presetCard}>
      <div className={styles.presetMedia}>
        {preset.thumbnailUrl ? (
          <img src={preset.thumbnailUrl} alt={preset.name} />
        ) : (
          <div className={styles.presetFallback}>{initials}</div>
        )}
        <div className={styles.presetShade} />
        <span className={styles.presetBadge}>IMAGE</span>
        <div className={styles.presetIdentity}>
          <strong>{preset.name}</strong>
          <small>{preset.description}</small>
        </div>
      </div>
      <div className={styles.presetMeta}>
        <span className={styles.presetCost}><DashboardIcon name="star" size={12} /> {preset.creditCost}</span>
        <span className={styles.presetCategory}>{preset.category.toUpperCase()}</span>
      </div>
    </Link>
  );
}

export default function StudioClient() {
  const [presets, setPresets] = useState([]);
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(`${apiBase}/api/studio/presets?category=${category}`, { signal: controller.signal })
      .then(r => r.json())
      .then(d => { setPresets(d.items || []); setLoading(false); })
      .catch(err => { if (err.name !== 'AbortError') { setNotice('Could not load presets.'); setLoading(false); } });
    return () => controller.abort();
  }, [category]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 3200);
    return () => clearTimeout(t);
  }, [notice]);

  return (
    <div className={styles.dashboard}>
      <DashboardSidebar active="Studio" savedCount={0} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} onUnavailable={setNotice} />
      <main className={styles.main}>
        <div className={styles.backGlow} />
        <header className={styles.mobileHeader}>
          <Link href="/studio" className={styles.brand}>
            <img className={styles.brandLogo} src="/7035402.svg" alt="LeakPorns" />
            <span>Leak<span>Porns</span></span>
          </Link>
          <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <DashboardIcon name="menu" />
          </button>
        </header>

        <div className={styles.heading}>
          <p>AI STUDIO</p>
          <h1>AI Image Generator</h1>
          <span>Create stunning AI-generated images from text prompts. Pick a style, describe your vision, and watch it come to life.</span>
        </div>

        <div className={styles.featureCards}>
          <div className={styles.featureCard}>
            <DashboardIcon name="layers" size={20} />
            <div>
              <strong>Image generation</strong>
              <small>~12s per render</small>
            </div>
          </div>
          <div className={styles.featureCard}>
            <DashboardIcon name="star" size={20} />
            <div>
              <strong>Multiple styles</strong>
              <small>{presets.length}+ presets</small>
            </div>
          </div>
          <div className={styles.featureCard}>
            <DashboardIcon name="wand" size={20} />
            <div>
              <strong>No queue</strong>
              <small>24/7 GPU power</small>
            </div>
          </div>
        </div>

        <div className={styles.chips}>
          {Object.entries(categoryLabels).map(([key, label]) => (
            <button key={key} type="button" className={category === key ? styles.selectedChip : ''} onClick={() => setCategory(key)}>
              {label}
            </button>
          ))}
        </div>

        <h2 className={styles.sectionTitle}>Our AI Models</h2>
        <p className={styles.sectionSub}>Explore our collection of AI image generation styles</p>

        {loading ? (
          <div className={styles.presetGrid}><div /><div /><div /><div /></div>
        ) : presets.length === 0 ? (
          <section className={styles.empty}>
            <DashboardIcon name="wand" size={28} />
            <h2>No presets found</h2>
            <p>Try a different category.</p>
          </section>
        ) : (
          <div className={styles.presetGrid}>
            {presets.map(p => <PresetCard key={p.id} preset={p} />)}
          </div>
        )}
      </main>

      <nav className={styles.bottomNav}>
        <Link href="/discover"><DashboardIcon name="compass" /><span>Home</span></Link>
        <Link href="/creators"><DashboardIcon name="grid" /><span>Explore</span></Link>
        <Link href="/studio" className={styles.bottomActive}><DashboardIcon name="wand" /><span>Studio</span></Link>
        <Link href="/chat"><DashboardIcon name="message" /><span>Chat</span></Link>
        <Link href="/auth/sign-in"><DashboardIcon name="user" /><span>Profile</span></Link>
      </nav>

      {notice && <div className={styles.toast} role="status"><DashboardIcon name="info" size={16} />{notice}</div>}
    </div>
  );
}
