/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["*"]
    }
  },
  reactStrictMode: true,
  output: 'standalone',
  // Avoid prerendering app routes to prevent env requirement at build time
  // Let them run dynamically at runtime inside the container with envs.
  generateEtags: false,
};

export default nextConfig;
