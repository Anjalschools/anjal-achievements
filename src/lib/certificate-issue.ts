import mongoose from "mongoose";
import Achievement from "@/models/Achievement";
import User from "@/models/User";
import { generateCertificateId, generateCertificateToken } from "@/lib/achievement-certificate";
import { buildCertificateSnapshot } from "@/lib/certificate-content";
import { isAchievementCertificateEligible } from "@/lib/certificate-eligibility";
import { achievementDisplayTitle, createStudentNotification } from "@/lib/student-notifications";
import type { CertificateIssuerKind } from "@/lib/achievement-approval-core";

const toPlain = (doc: mongoose.Document): Record<string, unknown> =>
  (typeof doc.toObject === "function" ? doc.toObject() : doc) as Record<string, unknown>;

export type CertificateIssueIssuer = {
  role: CertificateIssuerKind;
  userId: mongoose.Types.ObjectId;
};

/**
 * First eligible approved state issues once; later approvals do not re-issue.
 * Issuer metadata is frozen on first issue (or set on first issue after revoke if cleared).
 */
export const tryIssueCertificateForAchievementDoc = async (
  doc: mongoose.Document,
  issuer: CertificateIssueIssuer
): Promise<boolean> => {
  const plain = toPlain(doc);
  if (!isAchievementCertificateEligible(plain)) return false;

  const revoked = plain.certificateRevokedAt;
  const issued = plain.certificateIssued === true;
  if (issued && !revoked) return false;

  const uid = doc.get("userId") as mongoose.Types.ObjectId | undefined;
  if (!uid) return false;

  const user = await User.findById(uid).lean();
  if (!user) return false;
  const u = user as unknown as Record<string, unknown>;

  const prevVersion =
    typeof plain.certificateVersion === "number" && Number.isFinite(plain.certificateVersion)
      ? plain.certificateVersion
      : 0;
  const nextVersion = prevVersion + 1;
  const snapshot = buildCertificateSnapshot(plain, u, nextVersion);

  if (!safeString(plain.certificateId)) {
    doc.set("certificateId", generateCertificateId());
  }
  doc.set("certificateVerificationToken", generateCertificateToken());
  doc.set("certificateIssued", true);
  const at = new Date();
  doc.set("certificateIssuedAt", at);
  doc.set("certificateVersion", nextVersion);
  doc.set("certificateSnapshot", snapshot as Record<string, unknown>);
  doc.set("certificateRevokedAt", undefined);

  if (!plain.certificateApprovedByRole) {
    doc.set("certificateApprovedByRole", issuer.role);
    doc.set("certificateApprovedById", issuer.userId);
    doc.set("certificateApprovedAt", at);
  }

  await doc.save();

  try {
    const displayTitle = achievementDisplayTitle(
      plain as {
        nameAr?: string | null;
        nameEn?: string | null;
        achievementName?: string | null;
        title?: string | null;
      }
    );
    const token = String(doc.get("certificateVerificationToken") || "");
    await createStudentNotification({
      userId: uid,
      type: "certificate_issued",
      title: "صدرت شهادة شكر وتقدير",
      message: `صدرت شهادة للإنجاز «${displayTitle}». يمكنك عرضها وطباعتها من صفحة الإنجاز.`,
      relatedAchievementId: doc._id as mongoose.Types.ObjectId,
      relatedCertificateToken: token || undefined,
      metadata: { verifyPath: token ? `/verify/certificate/${token}` : undefined },
    });
  } catch (e) {
    console.error("[certificate issue notify]", e);
  }

  return true;
};

const safeString = (v: unknown): string =>
  typeof v === "string" && v.trim().length > 0 ? v.trim() : "";

export const tryIssueCertificateByAchievementId = async (
  id: string,
  issuer: CertificateIssueIssuer
): Promise<boolean> => {
  if (!mongoose.Types.ObjectId.isValid(id)) return false;
  const doc = await Achievement.findById(id);
  if (!doc) return false;
  return tryIssueCertificateForAchievementDoc(doc, issuer);
};
