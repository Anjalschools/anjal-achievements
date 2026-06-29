import type mongoose from "mongoose";

import { coerceAttachmentForStorage } from "@/lib/achievement-attachments";

/**
 * When an achievement becomes approved/published, it should appear in the student's
 * public portfolio by default — unless the school explicitly opted out
 * (`publicPortfolioSuppressedByAdmin === true`).
 */
export const applyDefaultShowInPublicPortfolioWhenPublished = (
  doc: mongoose.Document
): void => {
  if (doc.get("publicPortfolioSuppressedByAdmin") === true) {
    return;
  }
  doc.set("showInPublicPortfolio", true);
};

const attachmentHasUndecidedPublicVisibility = (raw: unknown): boolean => {
  if (typeof raw === "string") return true;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  if (!Object.prototype.hasOwnProperty.call(raw, "showInPublicPortfolio")) return true;
  const value = (raw as { showInPublicPortfolio?: unknown }).showInPublicPortfolio;
  return value === undefined || value === null;
};

export const applyDefaultPublicEvidenceVisibilityToAttachment = (
  raw: unknown
): { item: unknown; changed: boolean } => {
  if (!attachmentHasUndecidedPublicVisibility(raw)) {
    return { item: raw, changed: false };
  }

  const coerced = coerceAttachmentForStorage(raw);
  if (!coerced) {
    return { item: raw, changed: false };
  }

  const base =
    typeof raw === "object" && raw !== null && !Array.isArray(raw)
      ? { ...(raw as Record<string, unknown>) }
      : {};

  const next = {
    ...base,
    url: coerced.url,
    mimeType: coerced.mimeType,
    name: coerced.name,
    ...(coerced.key ? { key: coerced.key } : {}),
    ...(coerced.provider ? { provider: coerced.provider } : {}),
    ...(coerced.size !== undefined ? { size: coerced.size } : {}),
    ...(coerced.evidenceCategory ? { evidenceCategory: coerced.evidenceCategory } : {}),
    approved: true,
    showInPublicPortfolio: true,
  };

  return { item: next, changed: true };
};

/**
 * On final achievement approval, publish attachment evidence by default when the admin
 * has not made an explicit public visibility decision on each attachment.
 */
export const applyDefaultPublicEvidenceVisibility = (doc: mongoose.Document): void => {
  if (doc.get("publicPortfolioSuppressedByAdmin") === true) {
    return;
  }
  if (String(doc.get("status") || "") !== "approved") {
    return;
  }

  const attachmentsRaw = doc.get("attachments");
  if (!Array.isArray(attachmentsRaw) || attachmentsRaw.length === 0) {
    return;
  }

  let changed = false;
  const next: unknown[] = [];

  for (const item of attachmentsRaw) {
    const result = applyDefaultPublicEvidenceVisibilityToAttachment(item);
    if (result.changed) changed = true;
    next.push(result.item);
  }

  if (changed) {
    doc.set("attachments", next);
  }
};
