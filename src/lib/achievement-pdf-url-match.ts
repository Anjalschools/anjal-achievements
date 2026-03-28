/**
 * Pure URL / filename checks for PDF evidence (no server-only deps).
 */

export const isPdfAttachmentUrl = (u: string): boolean => {
  const s = u.trim();
  if (/^data:application\/pdf/i.test(s)) return true;
  return /\.pdf([?#\/]|$)/i.test(s);
};
