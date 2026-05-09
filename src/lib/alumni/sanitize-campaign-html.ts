import sanitizeHtml from "sanitize-html";

export const sanitizeCampaignHtml = (raw: string): string => {
  const s = String(raw || "");
  if (!s.trim()) return "";
  return sanitizeHtml(s, {
    allowedTags: ["p", "br", "b", "strong", "i", "em", "a", "ul", "ol", "li", "h1", "h2", "h3", "div", "span", "img"],
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "width", "height", "style"],
    },
    allowedSchemes: ["http", "https", "mailto"],
  }).trim();
};
