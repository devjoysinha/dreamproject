export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://leakporns.com').replace(/\/$/, '');
export const siteName = 'Leakporns';
export const defaultDescription = 'Browse OnlyFans, Fansly, and premium creator photos, videos, profiles, and available links on Leakporns.';

export function absoluteUrl(path = '/') {
  return new URL(path, `${siteUrl}/`).toString();
}

export function publicMetadata({ title, description = defaultDescription, path = '/', robots } = {}) {
  const url = absoluteUrl(path);
  return {
    title,
    description,
    alternates: { canonical: url },
    robots,
    openGraph: {
      title,
      description,
      url,
      siteName,
      type: 'website',
      locale: 'en_US',
      images: [{ url: absoluteUrl('/opengraph-image'), width: 1200, height: 630, alt: 'Leakporns' }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [absoluteUrl('/opengraph-image')] },
  };
}
