import './globals.css';
import CloudflareAnalytics from './components/CloudflareAnalytics';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://leakporns.com';

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Leakporns — Library',
  description: 'Creator media library',
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
