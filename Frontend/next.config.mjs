/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  images: { unoptimized: true },
  async rewrites() {
    const backendOrigin = process.env.BACKEND_ORIGIN || 'http://localhost:4000';
    return [
      { source: '/api/:path*', destination: `${backendOrigin}/api/:path*` },
      { source: '/health', destination: `${backendOrigin}/health` },
    ];
  },
};
export default nextConfig;
