'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './OpenLinkButton.module.css';

const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
const turnstileScript = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function isLinkRedirect(value) {
  return typeof value === 'string' && /^\/api\/open-links\/[^/]+\/redirect\?ticket=/.test(value);
}

function ShieldIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 7v5c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V7l-8-4Z" /><path d="M9 12.2 11.1 14l4.2-4.3" /></svg>;
}

export default function OpenLinkButton({ contentId, className = '', children }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [failed, setFailed] = useState(false);
  const challenge = useRef(null);
  const widgetId = useRef(null);
  const closeButton = useRef(null);
  const tokenHandler = useRef(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

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
    window.location.assign(redirectUrl);
  };

  const closeDialog = () => {
    if (busy) return;
    setDialogOpen(false);
    setFailed(false);
    setStatus('');
  };

  const start = async () => {
    if (!contentId || busy) return;
    setBusy(true);
    setFailed(false);
    setStatus('Preparing your secure link…');
    try {
      const result = await requestAccess();
      if (result.redirectUrl) return openRedirect(result.redirectUrl);
      if (result.verificationRequired) {
        setDialogOpen(true);
        setStatus('Complete the security check to open this link.');
        return;
      }
      setDialogOpen(true);
      setFailed(true);
      setStatus(result.error);
    } catch {
      setDialogOpen(true);
      setFailed(true);
      setStatus('We could not prepare this link. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const completeChallenge = async token => {
    if (!token || busy) return;
    setBusy(true);
    setFailed(false);
    setStatus('Verifying your browser…');
    try {
      const result = await requestAccess(token);
      if (result.redirectUrl) return openRedirect(result.redirectUrl);
      setFailed(true);
      setStatus(result.error);
      if (widgetId.current !== null && window.turnstile) window.turnstile.reset(widgetId.current);
    } catch {
      setFailed(true);
      setStatus('We could not verify this browser. Please try again.');
      if (widgetId.current !== null && window.turnstile) window.turnstile.reset(widgetId.current);
    } finally {
      setBusy(false);
    }
  };

  tokenHandler.current = completeChallenge;

  useEffect(() => {
    if (!dialogOpen) return undefined;
    closeButton.current?.focus();
    const closeOnEscape = event => { if (event.key === 'Escape') closeDialog(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [dialogOpen, busy]);

  useEffect(() => {
    if (!dialogOpen || failed) return undefined;
    if (!siteKey) {
      setFailed(true);
      setStatus('Browser verification is not configured yet. Please try again shortly.');
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
          setFailed(true);
          setStatus('The security check could not load. Check your connection and try again.');
        },
        'expired-callback': () => setStatus('The security check expired. Please complete it again.'),
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
        setFailed(true);
        setStatus('The security check could not load. Check your connection and try again.');
      });
    }

    return () => {
      active = false;
      script?.removeEventListener('load', renderWidget);
      if (widgetId.current !== null && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [dialogOpen, failed, siteKey]);

  const dialog = dialogOpen && typeof document !== 'undefined' ? createPortal(
    <div className={styles.overlay} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeDialog(); }}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="open-link-verification-title" aria-describedby="open-link-verification-status">
        <button ref={closeButton} className={styles.close} type="button" aria-label="Close verification" onClick={closeDialog} disabled={busy}>×</button>
        <div className={styles.icon}><ShieldIcon /></div>
        <p className={styles.eyebrow}>SECURE LINK</p>
        <h2 id="open-link-verification-title">Verify to open this link</h2>
        <p className={styles.copy}>A quick check helps keep automated tools from collecting destination links.</p>
        <div ref={challenge} className={styles.challenge} />
        <p id="open-link-verification-status" className={`${styles.status}${failed ? ` ${styles.statusError}` : ''}`} role="status" aria-live="polite">{status}</p>
        {failed && <button className={styles.retry} type="button" onClick={() => { setFailed(false); setStatus('Complete the security check to open this link.'); }}>Try again</button>}
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
