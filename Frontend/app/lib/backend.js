const localPreviewOrigin = process.env.NODE_ENV === 'development' ? 'https://leakporns.com' : 'http://localhost:4000';
const origin = process.env.BACKEND_ORIGIN || process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'production' ? 'http://127.0.0.1:4000' : localPreviewOrigin);

export function backendUrl(path, searchParams) {
  const url = new URL(path, origin);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export async function fetchBackendJson(path, { searchParams, revalidate = 30 } = {}) {
  try {
    const response = await fetch(backendUrl(path, searchParams), { next: { revalidate }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
