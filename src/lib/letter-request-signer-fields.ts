/**
 * Optional signer display fields for formal letters (admin-editable).
 * All strings trimmed; empty clears optional storage.
 */

const MAX_LEN = 200;

const trimField = (raw: unknown): string | undefined => {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  if (!t) return undefined;
  return t.length > MAX_LEN ? t.slice(0, MAX_LEN) : t;
};

export type LetterSignerPatchInput = {
  signerNameAr?: string;
  signerNameEn?: string;
  signerTitleAr?: string;
  signerTitleEn?: string;
  signerOrganizationLabelAr?: string;
  signerOrganizationLabelEn?: string;
};

/** Read optional signer fields from a PATCH/POST JSON body. */
export const parseLetterSignerFieldsFromBody = (o: Record<string, unknown>): LetterSignerPatchInput => {
  const out: LetterSignerPatchInput = {};
  if ("signerNameAr" in o) out.signerNameAr = trimField(o.signerNameAr);
  if ("signerNameEn" in o) out.signerNameEn = trimField(o.signerNameEn);
  if ("signerTitleAr" in o) out.signerTitleAr = trimField(o.signerTitleAr);
  if ("signerTitleEn" in o) out.signerTitleEn = trimField(o.signerTitleEn);
  if ("signerOrganizationLabelAr" in o) out.signerOrganizationLabelAr = trimField(o.signerOrganizationLabelAr);
  if ("signerOrganizationLabelEn" in o) out.signerOrganizationLabelEn = trimField(o.signerOrganizationLabelEn);
  return out;
};

const SIGNER_KEYS: (keyof LetterSignerPatchInput)[] = [
  "signerNameAr",
  "signerNameEn",
  "signerTitleAr",
  "signerTitleEn",
  "signerOrganizationLabelAr",
  "signerOrganizationLabelEn",
];

/**
 * Apply only keys present in `patch`. Empty/cleared values become "" in MongoDB
 * (optional strings); serialize strips empty strings for API consumers.
 */
export const applySignerFieldsToLetterDoc = (doc: Record<string, unknown>, patch: LetterSignerPatchInput): void => {
  for (const key of SIGNER_KEYS) {
    if (!(key in patch)) continue;
    const v = patch[key];
    doc[key] = v === undefined ? "" : v;
  }
};
