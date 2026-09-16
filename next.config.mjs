/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // The production site is served on the custom domain at the root.
  // Keep the project-path override available for local/legacy Pages testing.
  basePath: process.env.TREND_FORGE_BASE_PATH || '',
  trailingSlash: true,
  images: { unoptimized: true },
};
export default nextConfig;
