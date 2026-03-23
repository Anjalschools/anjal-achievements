/**
 * Certificate rules: one authorized approval (any party) + approved achievement is enough to issue.
 */

export type CertificateApprovedByRole = "admin" | "principal" | "activitySupervisor" | "judge";

export type AchievementCertificateLike = {
  status?: string;
  pendingReReview?: boolean;
  certificateIssued?: boolean;
  certificateRevokedAt?: Date | string | null;
  certificateVerificationToken?: string | null;
  certificateApprovedByRole?: CertificateApprovedByRole | string | null;
  certificateApprovedAt?: Date | string | null;
  /** @deprecated for eligibility — kept for display / audit only */
  reviewedAt?: Date | string | null;
};

const hasDate = (v: Date | string | null | undefined): boolean => {
  if (v === null || v === undefined) return false;
  if (v instanceof Date) return !Number.isNaN(v.getTime());
  if (typeof v === "string") return v.trim().length > 0;
  return false;
};

export type CertificateUiStatus = "not_available" | "issued" | "revoked";

export const resolveCertificateUiStatus = (a: AchievementCertificateLike): CertificateUiStatus => {
  if (hasDate(a.certificateRevokedAt)) return "revoked";
  if (a.certificateIssued === true && String(a.certificateVerificationToken || "").trim().length > 0) {
    return "issued";
  }
  return "not_available";
};

/** Snapshot fallback: issued before issuer metadata was stored */
export const isLegacyCertificateRecord = (a: AchievementCertificateLike): boolean =>
  a.certificateIssued === true && !hasDate(a.certificateApprovedAt) && !a.certificateApprovedByRole;

/**
 * Server may issue (or re-issue after revoke) when achievement is approved and not blocked.
 * Any single authorized reviewer approval is represented by moving the achievement to approved
 * with reviewedAt + party stamps on the approving route — we only require approved workflow here.
 */
export const isAchievementCertificateEligible = (a: AchievementCertificateLike): boolean => {
  if (String(a.status || "") !== "approved") return false;
  if (a.pendingReReview === true) return false;
  if (hasDate(a.certificateRevokedAt)) return false;
  return true;
};

export const canStudentViewCertificate = (a: AchievementCertificateLike): boolean => {
  if (!isAchievementCertificateEligible(a)) return false;
  if (!a.certificateIssued || !String(a.certificateVerificationToken || "").trim()) return false;
  return true;
};

export const isCertificateVerificationChainOk = (a: AchievementCertificateLike): boolean => {
  if (String(a.status || "") !== "approved") return false;
  if (a.pendingReReview === true) return false;
  if (!a.certificateIssued) return false;
  if (hasDate(a.certificateRevokedAt)) return false;
  return true;
};

export const labelCertificateIssuerRole = (
  role: string | undefined | null,
  locale: "ar" | "en"
): string => {
  const r = String(role || "").trim();
  const m: Record<string, { ar: string; en: string }> = {
    admin: { ar: "الإدارة", en: "Administration" },
    principal: { ar: "مدير المدرسة", en: "School principal" },
    activitySupervisor: { ar: "رائد / مشرف النشاط", en: "Activity supervisor" },
    judge: { ar: "محكم", en: "Judge" },
  };
  const hit = m[r];
  if (hit) return locale === "ar" ? hit.ar : hit.en;
  return locale === "ar" ? "جهة معتمدة" : "Authorized party";
};
