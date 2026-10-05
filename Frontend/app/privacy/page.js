import Link from 'next/link';
import { publicMetadata } from '../lib/seo';

export const metadata = publicMetadata({ title: 'Privacy Policy', description: 'Read the Leakporns privacy policy.', path: '/privacy' });
export default function PrivacyPage() { return <main style={{ maxWidth: 760, margin: '0 auto', padding: '72px 24px', color: '#eef4fa' }}><Link href="/">← Leakporns</Link><h1>Privacy Policy</h1><p>Leakporns uses your Google account only to create and secure your account. We store your verified email and display name; we do not request access to Gmail, Drive, Calendar, or other Google data.</p><p>Authentication sessions use secure, HttpOnly cookies. You can sign out at any time.</p><p>For privacy requests, contact the site operator.</p></main>; }
