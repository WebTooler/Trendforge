/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // GitHub Pages project-site deployment lives under /Trendforge.
  // A future owned custom domain can override this via the environment.
  basePath: process.env.TREND_FORGE_BASE_PATH || '/Trendforge',
  trailingSlash: true,
  images: { unoptimized: true },
};
export default nextConfig;
