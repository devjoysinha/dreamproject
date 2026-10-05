import './globals.css';
import CloudflareAnalytics from './components/CloudflareAnalytics';
import { absoluteUrl, defaultDescription, siteName, siteUrl } from './lib/seo';

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `${siteName} - Free OnlyFans Leaks & Photos`, template: `%s | ${siteName}` },
  description: defaultDescription,
  applicationName: siteName,
  referrer: 'strict-origin-when-cross-origin',
  formatDetection: { email: false, address: false, telephone: false },
  openGraph: { siteName, type: 'website', locale: 'en_US', images: [{ url: absoluteUrl('/opengraph-image'), width: 1200, height: 630, alt: siteName }] },
  twitter: { card: 'summary_large_image', images: [absoluteUrl('/opengraph-image')] },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48', type: 'image/x-icon' },
      { url: '/favicon-96.png', sizes: '96x96', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0d0b0a',
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}<CloudflareAnalytics /></body></html>;
}
