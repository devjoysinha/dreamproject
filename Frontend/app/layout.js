import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://leakporns.com';

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Leakporns — Library',
  description: 'Creator media library',
  icons: {
    icon: '/7035402.svg',
    shortcut: '/7035402.svg',
    apple: '/7035402.svg',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0d0b0a',
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
