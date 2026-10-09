let cached = null;

function fnv1a(str, seed = 0x811c9dc5) {
  let h = seed;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function hash(str) {
  return fnv1a(str, 0x811c9dc5) + fnv1a(str, 0x01000193) + fnv1a(str, 0xdeadbeef) + fnv1a(str, 0xcafebabe);
}

function canvasFingerprint() {
  try {
    const c = document.createElement('canvas');
    c.width = 200;
    c.height = 50;
    const ctx = c.getContext('2d');
    if (!ctx) return '';
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(0, 0, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('LeakP!fp@2024', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('LeakP!fp@2024', 4, 17);
    return c.toDataURL();
  } catch {
    return '';
  }
}

function webglFingerprint() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!gl) return '';
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : '';
    const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '';
    return `${vendor}~${renderer}`;
  } catch {
    return '';
  }
}

export function getFingerprint() {
  if (cached) return cached;
  const signals = [
    navigator.userAgent,
    navigator.language,
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.hardwareConcurrency || '',
    navigator.deviceMemory || '',
    navigator.maxTouchPoints || 0,
    canvasFingerprint(),
    webglFingerprint(),
  ];
  cached = hash(signals.join('|||'));
  return cached;
}
