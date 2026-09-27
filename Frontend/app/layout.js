import './globals.css';

export const metadata = { title: 'Haven — Library', description: 'Creator media library' };

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
