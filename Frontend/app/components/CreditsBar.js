'use client';

import { useEffect, useState } from 'react';
import { getFingerprint } from '../lib/fingerprint';
import styles from './OpenLinkButton.module.css';

const apiBase = process.env.NEXT_PUBLIC_API_URL || '';

export default function CreditsBar() {
  const [credits, setCredits] = useState(null);

  useEffect(() => {
    const fp = getFingerprint();
    fetch(`${apiBase}/api/credits?fingerprint=${encodeURIComponent(fp)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setCredits(data.credits); })
      .catch(() => {});
  }, []);

  if (credits === null) return null;

  return (
    <div className={styles.creditsBar}>
      <svg className={styles.creditsIcon} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
      <span className={styles.creditsCount}>{credits}</span> credits
    </div>
  );
}
