'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './OpenLinkButton.module.css';

const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
const turnstileScript = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function isLinkRedirect(value) {
  return typeof value === 'string' && /^\/api\/open-links\/[^/]+\/redirect\?ticket=/.test(value);
}

function Spinner() {
  return <svg className={styles.spinner} viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" /></svg>;
}

function InfoIcon() {
  return <svg className={styles.cardInfoIcon} viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>;
}

function PreviewCard({ card }) {
  if (!card) return null;
  const meta = [card.sizeDisplay, card.images != null && `${card.images} imgs`, card.videos != null && `${card.videos} videos`, card.relativeAge].filter(Boolean).join(' · ');
  return (
    <div className={styles.previewCard}>
      {card.imageUrl && <div className={styles.previewImageWrap}>
        <img className={styles.previewImage} src={card.imageUrl} alt="" loading="eager" />
        {card.isTrending && <span className={styles.previewTrending}>TRENDING</span>}
        <button className={styles.previewMore} type="button" aria-label="More" tabIndex={-1}>···</button>
      </div>}
      <div className={styles.previewMeta}>
        <p className={styles.previewTitle}>{card.title || card.modelName || 'Content'}</p>
        {meta && <p className={styles.previewStats}>{meta} <InfoIcon /></p>}
      </div>
    </div>
  );
}

export default function OpenLinkButton({ contentId, card, className = '', children }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [phase, setPhase] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const challenge = useRef(null);
  const widgetId = useRef(null);
  const tokenHandler = useRef(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const busy = phase === 'preparing' || phase === 'validating' || phase === 'redirecting';

  const requestAccess = async token => {
    const response = await fetch(`${apiBase}/api/open-links/${encodeURIComponent(contentId)}/access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(token ? { token } : {}),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && isLinkRedirect(data.redirectUrl)) return { redirectUrl: data.redirectUrl };
    return {
      error: data.error || 'We could not prepare this link. Please try again.',
      verificationRequired: response.status === 403 && data.verificationRequired === true,
    };
  };

  const openRedirect = redirectUrl => {
    setPhase('redirecting');
    window.location.assign(redirectUrl);
  };

  const closeDialog = () => {
    if (busy) return;
    setDialogOpen(false);
    setPhase('idle');
    setErrorMsg('');
  };

  const start = async () => {
    if (!contentId || busy) return;
    setPhase('preparing');
    setErrorMsg('');
    try {
      const result = await requestAccess();
      if (result.redirectUrl) {
        setDialogOpen(true);
        return openRedirect(result.redirectUrl);
      }
      if (result.verificationRequired) {
        setDialogOpen(true);
        setPhase('challenge');
        return;
      }
      setDialogOpen(true);
      setPhase('error');
      setErrorMsg(result.error);
    } catch {
      setDialogOpen(true);
      setPhase('error');
      setErrorMsg('We could not prepare this link. Check your connection and try again.');
    }
  };

  const completeChallenge = async token => {
    if (!token || busy) return;
    setPhase('validating');
    setErrorMsg('');
    try {
      const result = await requestAccess(token);
      if (result.redirectUrl) return openRedirect(result.redirectUrl);
      setPhase('error');
      setErrorMsg(result.error);
      if (widgetId.current !== null && window.turnstile) window.turnstile.reset(widgetId.current);
    } catch {
      setPhase('error');
      setErrorMsg('We could not verify this browser. Please try again.');
      if (widgetId.current !== null && window.turnstile) window.turnstile.reset(widgetId.current);
    }
  };

  tokenHandler.current = completeChallenge;

  useEffect(() => {
    if (!dialogOpen) return undefined;
    const closeOnEscape = event => { if (event.key === 'Escape') closeDialog(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [dialogOpen, busy]);

  useEffect(() => {
    if (!dialogOpen || phase !== 'challenge') return undefined;
    if (!siteKey) {
      setPhase('error');
      setErrorMsg('Browser verification is not configured yet. Please try again shortly.');
      return undefined;
    }

    let active = true;
    const renderWidget = () => {
      if (!active || !challenge.current || !window.turnstile || widgetId.current !== null) return;
      widgetId.current = window.turnstile.render(challenge.current, {
        sitekey: siteKey,
        theme: 'dark',
        callback: token => tokenHandler.current?.(token),
        'error-callback': () => {
          setPhase('error');
          setErrorMsg('The security check could not load. Check your connection and try again.');
        },
        'expired-callback': () => setErrorMsg('The security check expired. Please complete it again.'),
      });
    };

    let script = document.querySelector(`script[src="${turnstileScript}"]`);
    if (window.turnstile) renderWidget();
    else {
      if (!script) {
        script = document.createElement('script');
        script.src = turnstileScript;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', renderWidget);
      script.addEventListener('error', () => {
        setPhase('error');
        setErrorMsg('The security check could not load. Check your connection and try again.');
      });
    }

    return () => {
      active = false;
      script?.removeEventListener('load', renderWidget);
      if (widgetId.current !== null && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [dialogOpen, phase, siteKey]);

  const dialog = dialogOpen && typeof document !== 'undefined' ? createPortal(
    <div className={styles.overlay} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeDialog(); }}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="open-link-verification-title">

        {!busy && <button className={styles.close} type="button" aria-label="Close verification" onClick={closeDialog}>×</button>}

        <p id="open-link-verification-title" className={styles.redirectMsg}>
          We are redirecting you to the content you requested…
        </p>

        <div ref={challenge} className={styles.challenge} />

        {(phase === 'validating' || phase === 'redirecting') && (
          <div className={styles.validating} role="status" aria-live="polite">
            <Spinner />
            <span>{phase === 'redirecting' ? 'Redirecting' : 'Validating'}</span>
          </div>
        )}

        {phase === 'preparing' && (
          <div className={styles.validating} role="status" aria-live="polite">
            <Spinner />
            <span>Preparing</span>
          </div>
        )}

        {phase === 'error' && (
          <div className={styles.errorBlock}>
            <p className={styles.errorText}>{errorMsg}</p>
            <button className={styles.retry} type="button" onClick={() => { setPhase('challenge'); setErrorMsg(''); }}>Try again</button>
          </div>
        )}

        <PreviewCard card={card} />
      </section>
    </div>,
    document.body,
  ) : null;

  return <>
    <button className={`${styles.openLinkButton} ${className}`.trim()} type="button" onClick={start} disabled={!contentId || busy} aria-busy={busy}>
      {children}
    </button>
    {dialog}
  </>;
}
