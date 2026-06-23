const ALLOWED_HTTP_HOST_SUFFIXES = [
  "r2.cloudflarestorage.com",
  "cloudflarestorage.com",
  "res.cloudinary.com",
  "cloudinary.com",
];

const readAllowedHttpHosts = (): string[] => {
  const hosts = [...ALLOWED_HTTP_HOST_SUFFIXES];
  const r2Base = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL || process.env.R2_PUBLIC_BASE_URL || "";
  if (r2Base) {
    try {
      hosts.push(new URL(r2Base).hostname);
    } catch {
      /* ignore */
    }
  }
  return hosts;
};

export const isHttpDownloadAllowed = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    const host = parsed.hostname.toLowerCase();
    return readAllowedHttpHosts().some(
      (allowed) => host === allowed || host.endsWith(`.${allowed}`)
    );
  } catch {
    return false;
  }
};
