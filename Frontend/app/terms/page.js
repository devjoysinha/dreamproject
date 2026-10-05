import Link from 'next/link';
import { publicMetadata } from '../lib/seo';

export const metadata = publicMetadata({ title: 'Terms of Service', description: 'Read the Leakporns terms of service.', path: '/terms' });
export default function TermsPage() { return <main style={{ maxWidth: 760, margin: '0 auto', padding: '72px 24px', color: '#eef4fa' }}><Link href="/">← Leakporns</Link><h1>Terms of Service</h1><p>By using Leakporns, you agree to use the service lawfully and in accordance with these terms. Your account is personal to you, and you are responsible for keeping access to your Google account secure.</p><p>The service may change or be unavailable from time to time.</p><p>For questions about these terms, contact the site operator.</p></main>; }
