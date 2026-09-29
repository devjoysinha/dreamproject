const beaconUrl = 'https://static.cloudflareinsights.com/beacon.min.js';

export default function CloudflareAnalytics() {
  const token = process.env.CLOUDFLARE_WEB_ANALYTICS_TOKEN || process.env.NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN;
  if (!token) return null;

  return <script
    type="module"
    src={beaconUrl}
    data-cf-beacon={JSON.stringify({ token, spa: true })}
  />;
}
