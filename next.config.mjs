/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [],
    unoptimized: false,
  },
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
  },
};

export default nextConfig;
