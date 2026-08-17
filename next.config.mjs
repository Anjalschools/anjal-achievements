const r2PublicHostname = (() => {
  try {
    return process.env.R2_PUBLIC_BASE_URL ? new URL(process.env.R2_PUBLIC_BASE_URL).hostname : null;
  } catch {
    return null;
  }
})();

const remotePatterns = [
  { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
  { protocol: "https", hostname: "*.res.cloudinary.com", pathname: "/**" },
];
// R2 public object domain (home gallery images) — derived from env, not hardcoded.
if (r2PublicHostname) {
  remotePatterns.push({ protocol: "https", hostname: r2PublicHostname, pathname: "/**" });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [],
    unoptimized: false,
    remotePatterns,
  },
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
    instrumentationHook: true,
  },
};

export default nextConfig;
