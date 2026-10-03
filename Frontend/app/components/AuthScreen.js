'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import styles from './AuthScreen.module.css';

function GoogleMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.35 12.23c0-.72-.06-1.41-.19-2.08H12v3.93h5.23a4.47 4.47 0 0 1-1.94 2.93v2.55h3.14c1.84-1.69 2.92-4.18 2.92-7.33Z"/><path fill="#34A853" d="M12 21.73c2.62 0 4.81-.87 6.42-2.37l-3.14-2.55c-.87.58-1.98.92-3.28.92-2.52 0-4.66-1.7-5.42-3.99H3.34v2.63A9.7 9.7 0 0 0 12 21.73Z"/><path fill="#FBBC05" d="M6.58 13.74A5.82 5.82 0 0 1 6.28 12c0-.6.1-1.18.3-1.74V7.63H3.34A9.72 9.72 0 0 0 2.3 12c0 1.57.38 3.06 1.04 4.37l3.24-2.63Z"/><path fill="#EA4335" d="M12 6.27c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.8 3.34 14.61 2.27 12 2.27a9.7 9.7 0 0 0-8.66 5.36l3.24 2.63C7.34 7.97 9.48 6.27 12 6.27Z"/></svg>;
}

export function AuthScreen({ mode = 'sign-in' }) {
  const signUp = mode === 'sign-up';
  const [error, setError] = useState('');
  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get('error');
    if (!reason) return;
    setError(reason === 'google_cancelled' ? 'Google sign-in was cancelled. Please try again when ready.' : 'We could not complete Google sign-in. Please try again.');
  }, []);
  const heading = signUp ? 'Create your account' : 'Welcome back';
  const intro = signUp ? 'Create a free Leakporns account with your Google profile.' : 'Sign in securely to save creators and manage your account.';
  return <main className={styles.page}>
    <div className={styles.aurora} aria-hidden="true" />
    <header className={styles.header}><Link href="/" className={styles.brand} aria-label="Leakporns Discover home"><img src="/7035402.svg" alt="" /><span>Leak<span>Porns</span></span></Link><Link className={styles.back} href="/discover">Back to Discover</Link></header>
    <section className={styles.card} aria-labelledby="auth-title"><p className={styles.eyebrow}>LEAKPORNS ACCOUNT</p><h1 id="auth-title">{heading}</h1><p className={styles.intro}>{intro}</p>{error && <p className={styles.error} role="alert">{error}</p>}<a className={styles.googleButton} href="/api/auth/google?returnTo=/discover"><GoogleMark />Continue with Google</a><p className={styles.security}>Google verifies your identity. We only request your basic profile and verified email.</p><div className={styles.divider}><span /></div><p className={styles.switch}>{signUp ? 'Already have an account?' : 'New to Leakporns?'} <Link href={signUp ? '/auth/sign-in' : '/auth/sign-up'}>{signUp ? 'Sign in' : 'Create a free account'}</Link></p><p className={styles.legal}>By continuing, you agree to our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.</p></section>
  </main>;
}
