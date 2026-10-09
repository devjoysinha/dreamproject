'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './verification.module.css';

const turnstileScript = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function safeNext(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : '/';
}

export default function HumanVerification({ nextPath }) {
  const container = useRef(null);
  const widgetId = useRef(null);
  const [status, setStatus] = useState('Preparing security check…');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const submit = async token => {
    if (!token || isSubmitting) return;
    setIsSubmitting(true);
    setFailed(false);
    setStatus('Verifying your browser…');
    try {
      const response = await fetch('/api/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ token }),
      });
      if (!response.ok) throw new Error('not accepted');
      window.location.assign(safeNext(nextPath));
    } catch {
      setFailed(true);
      setStatus('We could not verify this browser. Please try again.');
      if (widgetId.current !== null && window.turnstile) window.turnstile.reset(widgetId.current);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!siteKey) {
      setFailed(true);
      setStatus('Browser verification is not configured yet. Please try again shortly.');
      return undefined;
    }
    let active = true;
    const renderWidget = () => {
      if (!active || !container.current || !window.turnstile || widgetId.current !== null) return;
      widgetId.current = window.turnstile.render(container.current, {
        sitekey: siteKey,
        theme: 'dark',
        callback: submit,
        'error-callback': () => {
          setFailed(true);
          setStatus('The security check could not load. Check your connection and try again.');
        },
        'expired-callback': () => setStatus('The security check expired. Please complete it again.'),
      });
      setStatus('Complete the security check to continue.');
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
      if (script) script.removeEventListener('load', renderWidget);
    };
  }, [siteKey]);

  const retry = () => {
    setFailed(false);
    setStatus('Retrying the security check…');
    if (widgetId.current !== null && window.turnstile) window.turnstile.reset(widgetId.current);
    else window.location.reload();
  };

  return <main className={styles.page}>
    <section className={styles.card} aria-labelledby="verification-title">
      <div className={styles.mark} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 4 7v5c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V7l-8-4Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></svg></div>
      <p className={styles.eyebrow}>Security check</p>
      <h1 id="verification-title">Please verify your browser</h1>
      <p className={styles.copy}>This brief check helps keep automated tools from copying site content. It usually completes without any extra step.</p>
      <div className={styles.challenge} ref={container} aria-label="Browser verification challenge" />
      <p className={`${styles.status}${failed ? ` ${styles.statusError}` : ''}`} role={failed ? 'alert' : 'status'} aria-live="polite">{status}</p>
      {failed && <button className={styles.retry} type="button" onClick={retry} disabled={isSubmitting}>Try again</button>}
    </section>
  </main>;
}
