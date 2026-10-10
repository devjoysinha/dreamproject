'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DashboardSidebar, DashboardIcon } from '../../components/DreamDashboard';
import styles from '../Studio.module.css';

const apiBase = process.env.NEXT_PUBLIC_API_URL || '';

function getSessionId() {
  const key = 'lp-studio-session';
  try {
    let id = localStorage.getItem(key);
    if (id && id.length >= 8) return id;
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function GalleryImage({ src, alt, onLoaded }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const handleLoad = (e) => {
    if (e.target.naturalWidth > 0) {
      setLoaded(true);
      onLoaded?.();
    } else if (attempt < 2) {
      setAttempt(a => a + 1);
    } else {
      setError(true);
    }
  };

  const retry = () => { setError(false); setAttempt(a => a + 1); };

  if (error) {
    return (
      <div className={styles.galleryFailed}>
        <span>Failed to load</span>
        <button type="button" onClick={retry} className={styles.retryBtn}>Retry</button>
      </div>
    );
  }

  const imgSrc = attempt > 0 ? `${src}&_r=${attempt}` : src;

  return (
    <>
      {!loaded && <div className={styles.galleryLoadingSkeleton} />}
      <img
        src={imgSrc}
        alt={alt}
        referrerPolicy="no-referrer"
        onLoad={handleLoad}
        onError={() => attempt < 2 ? setAttempt(a => a + 1) : setError(true)}
        style={!loaded ? { opacity: 0, position: 'absolute', pointerEvents: 'none' } : undefined}
      />
    </>
  );
}

export default function GenerateClient({ slug }) {
  const [preset, setPreset] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [viewImage, setViewImage] = useState(null);
  const [pendingImageId, setPendingImageId] = useState(null);
  const sessionId = useRef('');

  useEffect(() => { sessionId.current = getSessionId(); }, []);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/studio/presets/${slug}`, { signal: controller.signal });
        if (!res.ok) { setNotice('Preset not found.'); setLoading(false); return; }
        setPreset(await res.json());

        const sid = getSessionId();
        const galRes = await fetch(`${apiBase}/api/studio/gallery?sessionId=${encodeURIComponent(sid)}&limit=20`, { signal: controller.signal });
        if (galRes.ok) {
          const galData = await galRes.json();
          setImages(galData.items || []);
        }
      } catch (err) {
        if (err.name !== 'AbortError') setNotice('Could not load preset.');
      }
      setLoading(false);
    })();
    return () => controller.abort();
  }, [slug]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const generate = useCallback(async () => {
    const text = prompt.trim();
    if (!text || generating || !preset) return;
    setGenerating(true);
    try {
      const res = await fetch(`${apiBase}/api/studio/generate/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text, sessionId: sessionId.current }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Generation failed');
      }
      const result = await res.json();
      const newImage = { ...result, prompt: text, presetName: preset.name, presetSlug: slug };
      setPendingImageId(result.id);
      setImages(prev => [newImage, ...prev]);
      setPrompt('');
    } catch (err) {
      setNotice(err.message || 'Failed to generate image.');
      setGenerating(false);
    }
  }, [prompt, generating, preset, slug]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generate(); }
  };

  const initials = preset?.name?.split(' ').map(w => w[0]).join('') || '?';

  if (loading) {
    return (
      <div className={styles.dashboard}>
        <DashboardSidebar active="Studio" savedCount={0} mobileOpen={false} onClose={() => {}} onUnavailable={() => {}} />
        <main className={styles.main}>
          <div className={styles.backGlow} />
          <div className={styles.skeletonGrid}><div /><div /></div>
        </main>
      </div>
    );
  }

  if (!preset) {
    return (
      <div className={styles.dashboard}>
        <DashboardSidebar active="Studio" savedCount={0} mobileOpen={false} onClose={() => {}} onUnavailable={() => {}} />
        <main className={styles.main}>
          <div className={styles.backGlow} />
          <section className={styles.empty}>
            <DashboardIcon name="wand" size={28} />
            <h2>Preset not found</h2>
            <p>This style preset does not exist.</p>
          </section>
        </main>
      </div>
    );
  }

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

        <div className={styles.generateHeader}>
          <Link href="/studio" className={styles.backBtn} aria-label="Back to studio">
            <DashboardIcon name="arrow" size={16} />
          </Link>
          <div className={styles.presetFallbackSmall}>{initials}</div>
          <div>
            <h1>{preset.name}</h1>
            <p>{preset.description}</p>
          </div>
        </div>

        <div className={styles.generateBox}>
          <textarea
            className={styles.promptInput}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the image you want to create..."
            rows={3}
            maxLength={500}
            disabled={generating}
          />
          <div className={styles.generateActions}>
            <span className={styles.charCount}>{prompt.length}/500</span>
            <button
              type="button"
              className={styles.generateBtn}
              onClick={generate}
              disabled={!prompt.trim() || generating}
            >
              {generating ? (
                <><span className={styles.spinner} /> Generating...</>
              ) : (
                <><DashboardIcon name="wand" size={16} /> Generate</>
              )}
            </button>
          </div>
        </div>

        {generating && (
          <div className={styles.generatingOverlay}>
            <div className={styles.generatingPulse} />
            <p>Creating your image... this takes ~12 seconds</p>
          </div>
        )}

        {images.length > 0 && (
          <>
            <h2 className={styles.sectionTitle}>Generated Images</h2>
            <div className={styles.galleryGrid}>
              {images.map((img, i) => (
                <div key={img.id || i} className={styles.galleryItem} onClick={() => setViewImage(img)}>
                  <GalleryImage
                    src={img.imageUrl}
                    alt={img.prompt}
                    onLoaded={img.id === pendingImageId ? () => { setPendingImageId(null); setGenerating(false); } : undefined}
                  />
                  <div className={styles.galleryOverlay}>
                    <small>{img.prompt}</small>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      <nav className={styles.bottomNav}>
        <Link href="/discover"><DashboardIcon name="compass" /><span>Home</span></Link>
        <Link href="/creators"><DashboardIcon name="grid" /><span>Explore</span></Link>
        <Link href="/studio" className={styles.bottomActive}><DashboardIcon name="wand" /><span>Studio</span></Link>
        <Link href="/chat"><DashboardIcon name="message" /><span>Chat</span></Link>
        <Link href="/auth/sign-in"><DashboardIcon name="user" /><span>Profile</span></Link>
      </nav>

      {viewImage && (
        <div className={styles.lightbox} onClick={() => setViewImage(null)}>
          <button type="button" className={styles.lightboxClose} onClick={() => setViewImage(null)} aria-label="Close">
            <DashboardIcon name="x" size={20} />
          </button>
          <img src={viewImage.imageUrl} alt={viewImage.prompt} referrerPolicy="no-referrer" onClick={e => e.stopPropagation()} />
          <p className={styles.lightboxCaption}>{viewImage.prompt}</p>
        </div>
      )}

      {notice && <div className={styles.toast} role="status"><DashboardIcon name="info" size={16} />{notice}</div>}
    </div>
  );
}
