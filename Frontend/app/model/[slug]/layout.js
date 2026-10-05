import { absoluteUrl, siteName, siteUrl } from '../../lib/seo';

const backendOrigin = process.env.BACKEND_ORIGIN || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const countryNames = {
  AE: 'United Arab Emirates', AR: 'Argentina', AU: 'Australia', BE: 'Belgium', BR: 'Brazil', CA: 'Canada',
  CH: 'Switzerland', CN: 'China', CO: 'Colombia', CU: 'Cuba', CZ: 'Czechia', DE: 'Germany', DO: 'Dominican Republic',
  DZ: 'Algeria', EE: 'Estonia', ES: 'Spain', FI: 'Finland', FR: 'France', GB: 'United Kingdom', GR: 'Greece',
  IL: 'Israel', IN: 'India', IR: 'Iran', IT: 'Italy', JP: 'Japan', KR: 'South Korea', LB: 'Lebanon', LU: 'Luxembourg',
  MA: 'Morocco', MX: 'Mexico', MY: 'Malaysia', NL: 'Netherlands', NZ: 'New Zealand', PH: 'Philippines', PL: 'Poland',
  PR: 'Puerto Rico', PT: 'Portugal', RO: 'Romania', RU: 'Russia', SE: 'Sweden', SG: 'Singapore', TH: 'Thailand',
  TR: 'Türkiye', TW: 'Taiwan', UA: 'Ukraine', US: 'United States', VE: 'Venezuela', VN: 'Vietnam', ZA: 'South Africa',
};

function profileSlug(value = '') {
  return decodeURIComponent(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function fallbackName(value = '') {
  return decodeURIComponent(value).replace(/[-_]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function cleanText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function truncate(value, maxLength = 160) {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).replace(/\s+\S*$/, '')}...`;
}

function getSummary(model) {
  const meta = model?.profileMeta || {};
  const countryCode = model?.summaryDisplay?.match(/\b([A-Z]{2})\b/)?.[1];
  return [meta.age, countryNames[countryCode] || countryCode, meta.race].filter(Boolean).join(', ') || cleanText(model?.summaryDisplay || 'creator');
}

async function getModel(rawSlug) {
  try {
    const endpoint = new URL(`/api/models/${encodeURIComponent(profileSlug(rawSlug))}`, backendOrigin);
    endpoint.searchParams.set('limit', '1');
    const response = await fetch(endpoint, { next: { revalidate: 3600 } });
    return response.ok ? response.json() : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { slug: rawSlug } = await params;
  const model = await getModel(rawSlug);
  const name = model?.name || fallbackName(rawSlug);
  const title = `${name} OnlyFans Leaks - Free Photos & Videos`;
  const summary = getSummary(model);
  const description = truncate(`Explore ${name}'s available OnlyFans photos, videos, and open links${summary ? ` — ${summary}` : ''}. ${model?.bio || ''}`);
  const slug = profileSlug(rawSlug);
  const canonical = absoluteUrl(`/model/${encodeURIComponent(slug)}`);
  const image = model?.profileImageUrl || absoluteUrl('/opengraph-image');
  const isIndexable = Number(model?.openLinkCount) > 0;

  return {
    title,
    description,
    authors: [{ name: siteName }],
    creator: siteName,
    publisher: siteName,
    category: 'entertainment',
    metadataBase: new URL(siteUrl),
    alternates: { canonical, languages: { 'en-US': canonical, 'x-default': canonical } },
    robots: {
      index: isIndexable,
      follow: true,
      googleBot: { index: isIndexable, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName,
      type: 'website',
      locale: 'en_US',
      images: [{ url: image, width: 800, height: 600, alt: `${name} profile` }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}

export default function ModelLayout({ children }) {
  return children;
}
