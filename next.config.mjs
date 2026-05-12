/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [],
    unoptimized: false,
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
      { protocol: "https", hostname: "*.res.cloudinary.com", pathname: "/**" },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
    instrumentationHook: true,
  },
};

export default nextConfig;
