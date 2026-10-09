import { NextResponse } from 'next/server';

const encoder = new TextEncoder();

function isEnabled() {
  return process.env.HUMAN_VERIFICATION_ENABLED === 'true';
}

function isPublicPath(pathname) {
  return pathname === '/verify'
    || pathname.startsWith('/api/')
    || pathname.startsWith('/_next/')
    || pathname === '/favicon.ico'
    || pathname === '/robots.txt'
    || pathname === '/sitemap.xml'
    || /\.(?:avif|css|gif|ico|jpe?g|js|map|mjs|png|svg|txt|webp)$/i.test(pathname);
}

function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function sameBytes(first, second) {
  if (first.length !== second.length) return false;
  let difference = 0;
  for (let index = 0; index < first.length; index += 1) difference |= first[index] ^ second[index];
  return difference === 0;
}

async function validHumanSession(value) {
  const secret = process.env.HUMAN_VERIFICATION_SECRET;
  if (!secret || !value || value.length > 1024) return false;
  const [version, payload, signature, extra] = value.split('.');
  if (version !== 'v1' || !payload || !signature || extra) return false;

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`${version}.${payload}`)));
    if (!sameBytes(expected, base64UrlToBytes(signature))) return false;
    const session = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)));
    const now = Math.floor(Date.now() / 1000);
    return Number.isInteger(session.iat)
      && Number.isInteger(session.exp)
      && session.iat <= now + 60
      && session.exp > now;
  } catch {
    return false;
  }
}

export async function proxy(request) {
  if (!isEnabled() || isPublicPath(request.nextUrl.pathname)) return NextResponse.next();
  const cookieName = process.env.HUMAN_VERIFICATION_COOKIE_NAME || 'lp_human';
  if (await validHumanSession(request.cookies.get(cookieName)?.value)) return NextResponse.next();

  const verificationUrl = request.nextUrl.clone();
  verificationUrl.pathname = '/verify';
  verificationUrl.search = '';
  verificationUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(verificationUrl);
}

export const config = {
  matcher: '/:path*',
};
