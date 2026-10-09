'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getFingerprint } from '../lib/fingerprint';
import styles from './OpenLinkButton.module.css';

const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
const capApiEndpoint = process.env.NEXT_PUBLIC_CAP_API_ENDPOINT || '';

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

function ensureCapScript() {
  if (customElements.get('cap-widget')) return Promise.resolve();
  if (!document.querySelector('script[data-cap-widget]')) {
    const s = document.createElement('script');
    s.type = 'module';
    s.setAttribute('data-cap-widget', '');
    s.textContent = 'import "https://cdn.jsdelivr.net/npm/cap-widget";';
    document.head.appendChild(s);
  }
  return Promise.race([
    customElements.whenDefined('cap-widget'),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 12_000)),
  ]);
}

export default function OpenLinkButton({ contentId, card, className = '', children }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [phase, setPhase] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const challenge = useRef(null);
  const tokenHandler = useRef(null);

  const busy = phase === 'preparing' || phase === 'validating' || phase === 'redirecting';

  const requestAccess = async token => {
    const fp = getFingerprint();
    const payload = { fingerprint: fp };
    if (token) payload.token = token;
    const response = await fetch(`${apiBase}/api/open-links/${encodeURIComponent(contentId)}/access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && isLinkRedirect(data.redirectUrl)) return { redirectUrl: data.redirectUrl };
    if (response.status === 402 && data.creditsRequired) {
      return { creditsRequired: true, credits: data.credits ?? 0, paymentUrl: data.paymentUrl };
    }
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
      if (result.creditsRequired) {
        setDialogOpen(true);
        setPhase('payment');
        setErrorMsg(result.paymentUrl || 'https://pay.leakporns.com/');
        return;
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
      if (result.creditsRequired) {
        setPhase('payment');
        setErrorMsg(result.paymentUrl || 'https://pay.leakporns.com/');
        return;
      }
      setPhase('error');
      setErrorMsg(result.error);
    } catch {
      setPhase('error');
      setErrorMsg('We could not verify this browser. Please try again.');
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
    if (!capApiEndpoint) {
      setPhase('error');
      setErrorMsg('Browser verification is not configured yet. Please try again shortly.');
      return undefined;
    }

    let active = true;

    const renderWidget = () => {
      if (!active || !challenge.current) return;
      challenge.current.innerHTML = '';
      const widget = document.createElement('cap-widget');
      widget.setAttribute('data-cap-api-endpoint', capApiEndpoint);
      widget.style.cssText = '--cap-background:rgba(30,30,35,.9);--cap-border-color:rgba(148,163,184,.18);--cap-border-radius:12px;--cap-color:#e8ecf0;--cap-spinner-color:#7de3ff;--cap-spinner-background-color:rgba(148,163,184,.2);--cap-checkbox-background:rgba(148,163,184,.1);--cap-checkbox-border:1px solid rgba(148,163,184,.3);--cap-font:system-ui,-apple-system,sans-serif';
      widget.addEventListener('solve', event => tokenHandler.current?.(event.detail.token));
      widget.addEventListener('error', event => {
        if (!active) return;
        setPhase('error');
        setErrorMsg(event.detail?.message || 'The security check failed. Please try again.');
      });
      challenge.current.appendChild(widget);
    };

    ensureCapScript()
      .then(() => { if (active) renderWidget(); })
      .catch(() => {
        if (active) {
          setPhase('error');
          setErrorMsg('The security check could not load. Check your connection and try again.');
        }
      });

    return () => {
      active = false;
      if (challenge.current) challenge.current.innerHTML = '';
    };
  }, [dialogOpen, phase]);

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

        {phase === 'payment' && (
          <div className={styles.paymentBlock}>
            <p className={styles.paymentTitle}>Credits Exhausted</p>
            <p className={styles.paymentText}>You have used all 3 free link opens. Pay ₹19 in BTC to unlock more access.</p>
            <button className={styles.payButton} type="button" onClick={async () => {
              try {
                setPhase('preparing');
                const fp = getFingerprint();
                const r = await fetch(`${apiBase}/api/payments/create`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ fingerprint: fp }),
                });
                const data = await r.json();
                if (r.ok && data.paymentUrl) {
                  window.open(data.paymentUrl, '_blank', 'noopener');
                  setPhase('payment');
                } else {
                  window.open('https://pay.leakporns.com/', '_blank', 'noopener');
                  setPhase('payment');
                }
              } catch {
                window.open('https://pay.leakporns.com/', '_blank', 'noopener');
                setPhase('payment');
              }
            }}>Pay ₹19 to Continue</button>
            <button className={styles.closePayment} type="button" onClick={closeDialog}>Close</button>
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
