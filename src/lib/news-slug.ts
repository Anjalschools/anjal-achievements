/** URL-safe slug from title (ASCII); falls back to prefix + random. */
export const slugifyTitle = (title: string, fallbackPrefix = "news"): string => {
  const t = String(title || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
  const ascii = t
    .replace(/[^a-z0-9\u0600-\u06FF\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (ascii.length >= 3) return ascii.slice(0, 120);
  return `${fallbackPrefix}-${Date.now().toString(36)}`;
};
