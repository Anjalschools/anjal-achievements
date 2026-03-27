import sanitizeHtml from "sanitize-html";

const strictTextOptions: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: "discard",
};

/**
 * Server-safe HTML / script stripping for user-authored text (descriptions, notes, contact messages).
 */
export const sanitizeUserText = (input: string | undefined | null): string => {
  if (input == null) return "";
  const s = String(input);
  if (!s.trim()) return "";
  return sanitizeHtml(s, strictTextOptions).trim();
};
