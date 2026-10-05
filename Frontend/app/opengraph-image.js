import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Leakporns — OnlyFans photos and videos';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '78px', color: '#f7fbff', background: 'linear-gradient(135deg, #080c15 0%, #151c34 52%, #123b51 100%)' }}>
      <div style={{ display: 'flex', alignItems: 'center', color: '#7be4f6', fontSize: 27, fontWeight: 700, letterSpacing: 6 }}>LEAKPORNS</div>
      <div style={{ display: 'flex', flexDirection: 'column' }}><div style={{ fontSize: 82, fontWeight: 800, letterSpacing: -4 }}>OnlyFans photos &amp; videos</div><div style={{ marginTop: 20, color: '#bdd0e5', fontSize: 31 }}>Profiles, collections, and available links.</div></div>
      <div style={{ display: 'flex', color: '#8da5c0', fontSize: 22 }}>leakporns.com</div>
    </div>,
    size,
  );
}
