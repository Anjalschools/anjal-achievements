/** Accept only HTTPS image URLs from our image host (Cloudinary). */
export const isAllowedAlumniMemoryImageUrl = (raw: string): boolean => {
  const s = (raw || "").trim();
  if (!s.startsWith("https://")) return false;
  try {
    const u = new URL(s);
    const host = u.hostname.toLowerCase();
    if (host === "res.cloudinary.com" || host.endsWith(".res.cloudinary.com")) return true;
    return false;
  } catch {
    return false;
  }
};
