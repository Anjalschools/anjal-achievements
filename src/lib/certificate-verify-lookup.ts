import Achievement from "@/models/Achievement";
import User from "@/models/User";
import {
  type AchievementCertificateLike,
  isCertificateVerificationChainOk,
  resolveCertificateUiStatus,
} from "@/lib/certificate-eligibility";
import type { AppreciationCertificateSnapshot } from "@/lib/certificate-content";

const ACHIEVEMENT_VERIFY_SELECT =
  "certificateId certificateVerificationToken status certificateIssued certificateIssuedAt certificateRevokedAt certificateSnapshot certificateVersion certificateSupersededTokens pendingReReview certificateApprovedByRole certificateApprovedAt adminApprovedAt principalApprovedAt activitySupervisorApprovedAt judgeApprovedAt achievementName nameAr nameEn title achievementLevel level achievementYear userId";

/** Display ID printed on certificate: CERT-2026- + first 6 chars of stored certificateId. */
export const formatCertificateDisplayId = (certificateId: string | undefined | null): string => {
  if (!certificateId || !String(certificateId).trim()) return "CERT-2026-000000";
  return `CERT-2026-${String(certificateId).trim().slice(0, 6).toUpperCase()}`;
};

const DISPLAY_CERT_RE = /^CERT[\s-]*2026[\s-]*([0-9A-Fa-f]{6})$/i;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type CertificateVerifyLookupFailure =
  | { ok: false; reason: "not_found" | "superseded" | "revoked" | "invalid_chain" };

export type CertificateVerifyLookupSuccess = {
  ok: true;
  doc: Record<string, unknown>;
  tokenUsed: string | null;
};

/**
 * Resolve achievement by verification token, friendly CERT-2026-XXXXXX id, or raw certificate UUID.
 */
export const lookupAchievementForCertificateVerification = async (
  raw: string
): Promise<CertificateVerifyLookupFailure | CertificateVerifyLookupSuccess> => {
  const id = String(raw || "").trim();
  if (!id) {
    return { ok: false, reason: "not_found" };
  }

  let tokenUsed: string | null = null;

  let doc = await Achievement.findOne({
    $or: [{ certificateVerificationToken: id }, { certificateSupersededTokens: id }],
  })
    .select(ACHIEVEMENT_VERIFY_SELECT)
    .lean();

  if (doc) {
    tokenUsed = id;
  }

  if (!doc) {
    const displayMatch = id.match(DISPLAY_CERT_RE);
    if (displayMatch) {
      const suf = displayMatch[1].toUpperCase();
      const prefixRe = new RegExp(`^${escapeRegex(suf)}`, "i");
      const candidates = await Achievement.find({
        certificateId: prefixRe,
        certificateIssued: true,
      })
        .select(ACHIEVEMENT_VERIFY_SELECT)
        .sort({ certificateIssuedAt: -1 })
        .limit(5)
        .lean();
      doc = candidates[0] || null;
    }
  }

  if (!doc && UUID_RE.test(id)) {
    doc = await Achievement.findOne({ certificateId: id })
      .select(ACHIEVEMENT_VERIFY_SELECT)
      .lean();
  }

  if (!doc) {
    return { ok: false, reason: "not_found" };
  }

  const drec = doc as unknown as Record<string, unknown>;

  const isSuperseded =
    tokenUsed !== null &&
    Array.isArray(drec.certificateSupersededTokens) &&
    (drec.certificateSupersededTokens as string[]).includes(tokenUsed) &&
    String(drec.certificateVerificationToken || "") !== tokenUsed;

  if (isSuperseded) {
    return { ok: false, reason: "superseded" };
  }

  const chainOk = isCertificateVerificationChainOk(doc as AchievementCertificateLike);
  if (!chainOk) {
    const revoked = Boolean(drec.certificateRevokedAt);
    return { ok: false, reason: revoked ? "revoked" : "invalid_chain" };
  }

  return { ok: true, doc: drec, tokenUsed };
};

export type CertificateVerifyPublicPayload = {
  valid: true;
  studentNameAr: string;
  studentNameEn: string;
  gradeAr: string;
  gradeEn: string;
  achievementTitleAr: string;
  achievementTitleEn: string;
  resultAr: string;
  resultEn: string;
  levelAr: string;
  levelEn: string;
  dateAr: string;
  dateEn: string;
  school: string;
  schoolAr: string;
  certificateId: string;
  certificateStatus: string;
};

const asStr = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export const buildCertificateVerifyPublicPayload = async (
  drec: Record<string, unknown>
): Promise<CertificateVerifyPublicPayload> => {
  const uid = drec.userId as { toString(): string };
  const user = await User.findById(uid).select("fullName fullNameAr fullNameEn name email").lean();
  const u = user as Record<string, unknown> | null;

  const studentNameAr =
    asStr(u?.fullNameAr) ||
    asStr(u?.fullName) ||
    asStr(u?.name) ||
    asStr(drec.nameAr) ||
    "";
  const studentNameEn =
    asStr(u?.fullNameEn) ||
    asStr(u?.fullName) ||
    asStr(u?.name) ||
    asStr(drec.nameEn) ||
    "";

  const snap = drec.certificateSnapshot as AppreciationCertificateSnapshot | undefined;

  const achievementTitleAr =
    asStr(snap?.achievementTitleAr) || asStr(drec.nameAr) || asStr(drec.achievementName) || asStr(drec.title) || "";
  const achievementTitleEn =
    asStr(snap?.achievementTitleEn) || asStr(drec.nameEn) || asStr(drec.achievementName) || asStr(drec.title) || "";

  const gradeAr = asStr(snap?.gradeAr) || "";
  const gradeEn = asStr(snap?.gradeEn) || "";

  const resultAr = asStr(snap?.resultSummaryAr) || "";
  const resultEn = asStr(snap?.resultSummaryEn) || "";

  const levelAr = asStr(snap?.levelAr) || "";
  const levelEn = asStr(snap?.levelEn) || "";

  const dateAr = asStr(snap?.dateAr) || "";
  const dateEn = asStr(snap?.dateEn) || "";

  const certLike = drec as unknown as AchievementCertificateLike;
  const certificateStatus = resolveCertificateUiStatus(certLike);

  return {
    valid: true,
    studentNameAr: studentNameAr || studentNameEn || "—",
    studentNameEn: studentNameEn || studentNameAr || "—",
    gradeAr: gradeAr || gradeEn || "—",
    gradeEn: gradeEn || gradeAr || "—",
    achievementTitleAr: achievementTitleAr || achievementTitleEn || "—",
    achievementTitleEn: achievementTitleEn || achievementTitleAr || "—",
    resultAr: resultAr || resultEn || "—",
    resultEn: resultEn || resultAr || "—",
    levelAr: levelAr || levelEn || "—",
    levelEn: levelEn || levelAr || "—",
    dateAr: dateAr || dateEn || "—",
    dateEn: dateEn || dateAr || "—",
    school: "Al-Anjal Private Schools",
    schoolAr: "مدارس الأنجال الأهلية",
    certificateId: formatCertificateDisplayId(asStr(drec.certificateId)),
    certificateStatus,
  };
};
