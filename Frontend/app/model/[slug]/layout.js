const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://leakporns.com';
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

function getAliases(model) {
  const aliases = typeof model?.profileMeta?.aliases === 'string' ? model.profileMeta.aliases.split('·') : [];
  return [...new Set([model?.name, ...aliases, model?.sourceQuery].filter(Boolean).map(cleanText))];
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
  const aliases = getAliases(model || { name });
  const title = `${aliases.join(', ')} OnlyFans Leaks - Free Photos & Videos - Leakporns`;
  const summary = getSummary(model);
  const description = truncate(`Explore ${name}'s OnlyFans leaks videos and photos for free - ${summary}. ${model?.bio || `Browse ${name}'s available creator media and open links.`}`);
  const tags = (model?.tags || []).map(tag => tag.label).filter(Boolean);
  const keywords = [...new Set([
    ...aliases,
    ...aliases.map(alias => `${alias} OnlyFans`),
    ...aliases.map(alias => `${alias} leaks`),
    ...aliases.map(alias => `${alias} photos`),
    ...tags,
    'OnlyFans leaks',
    'free photos and videos',
    'Leakporns',
  ])];
  const slug = profileSlug(rawSlug);
  const canonical = `${siteUrl}/model/${encodeURIComponent(slug)}`;
  const image = model?.profileImageUrl || undefined;
  const isIndexable = Number(model?.openLinkCount) > 0;

  return {
    title,
    description,
    keywords,
    authors: [{ name: 'Leakporns' }],
    creator: 'Leakporns',
    publisher: 'Leakporns',
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
      siteName: 'Leakporns',
      type: 'website',
      locale: 'en_US',
      ...(image ? { images: [{ url: image, width: 800, height: 600, alt: `${name} profile` }] } : {}),
    },
    twitter: { card: 'summary_large_image', title, description, ...(image ? { images: [image] } : {}) },
  };
}

export default function ModelLayout({ children }) {
  return children;
}
