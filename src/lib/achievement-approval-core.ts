import mongoose from "mongoose";
import type { ReviewerUser } from "@/lib/review-auth";
import { applyDefaultShowInPublicPortfolioWhenPublished } from "@/lib/achievement-public-portfolio-policy";
import { calculateAchievementScore } from "@/lib/achievement-scoring";

export type CertificatePartyStamp = "fromRole" | "principal" | "activitySupervisor" | "judge";

/**
 * Maps reviewer DB role → which party timestamp to set on main "approve" route.
 */
export const stampAuthorizedPartyFromReviewerRole = (
  doc: mongoose.Document,
  reviewerRole: string,
  userId: mongoose.Types.ObjectId,
  now: Date
): void => {
  const r = String(reviewerRole || "");
  if (r === "admin") {
    doc.set("adminApprovedAt", now);
    doc.set("adminApprovedBy", userId);
    return;
  }
  if (r === "schoolAdmin") {
    doc.set("principalApprovedAt", now);
    doc.set("principalApprovedBy", userId);
    return;
  }
  if (r === "teacher" || r === "supervisor") {
    doc.set("activitySupervisorApprovedAt", now);
    doc.set("activitySupervisorApprovedBy", userId);
    return;
  }
  if (r === "judge") {
    doc.set("judgeApprovedAt", now);
    doc.set("judgeApprovedBy", userId);
    return;
  }
  doc.set("activitySupervisorApprovedAt", now);
  doc.set("activitySupervisorApprovedBy", userId);
};

const stampParty = (
  doc: mongoose.Document,
  party: Exclude<CertificatePartyStamp, "fromRole">,
  userId: mongoose.Types.ObjectId,
  now: Date
): void => {
  if (party === "principal") {
    doc.set("principalApprovedAt", now);
    doc.set("principalApprovedBy", userId);
    return;
  }
  if (party === "activitySupervisor") {
    doc.set("activitySupervisorApprovedAt", now);
    doc.set("activitySupervisorApprovedBy", userId);
    return;
  }
  doc.set("judgeApprovedAt", now);
  doc.set("judgeApprovedBy", userId);
};

/**
 * Full platform approval (status, locks, review note). Optionally stamps the authorizing party.
 */
export const applyAchievementPlatformApproval = (
  doc: mongoose.Document,
  gate: { user: ReviewerUser },
  now: Date,
  body: { reviewNote?: string },
  party: CertificatePartyStamp
): void => {
  doc.set("pendingReReview", false);
  doc.set("previousApprovedSnapshot", undefined);
  doc.set("changedFields", []);
  doc.set("requiresCommitteeReview", false);
  doc.set("verificationStatus", "verified");
  doc.set("verificationSummary", "Final administrative approval completed.");
  doc.set("lastAdminReviewedAt", now);
  doc.set("lastEditedByRole", "admin");
  doc.set("status", "approved");
  if (typeof body.reviewNote === "string" && body.reviewNote.trim()) {
    doc.set("reviewNote", body.reviewNote.trim().slice(0, 2000));
  }
  doc.set("reviewedBy", gate.user._id);
  doc.set("reviewedAt", now);
  doc.set("lockedAt", now);
  doc.set("lockedBy", gate.user._id);
  doc.set("certificateRevokedAt", undefined);

  const scoreResult = calculateAchievementScore({
    achievementType: String(doc.get("achievementType") || ""),
    achievementLevel: String(doc.get("achievementLevel") || ""),
    resultType: String(doc.get("resultType") || ""),
    achievementName: String(doc.get("achievementName") || ""),
    medalType: String(doc.get("medalType") || "") || undefined,
    rank: String(doc.get("rank") || "") || undefined,
    participationType: String(doc.get("participationType") || "") || undefined,
    // Final admin approval must release points eligibility.
    requiresCommitteeReview: false,
  });
  if (scoreResult.isEligible && scoreResult.score > 0) {
    doc.set("score", scoreResult.score);
    doc.set("scoreBreakdown", scoreResult.scoreBreakdown);
  }

  const uid = gate.user._id as mongoose.Types.ObjectId;
  if (party === "fromRole") {
    stampAuthorizedPartyFromReviewerRole(doc, String(gate.user.role || ""), uid, now);
  } else {
    stampParty(doc, party, uid, now);
  }

  if (typeof body.reviewNote === "string" && body.reviewNote.trim()) {
    const comments = Array.isArray(doc.get("reviewComments"))
      ? [...(doc.get("reviewComments") as unknown[])]
      : [];
    comments.push({
      authorId: gate.user._id,
      authorRole: String(gate.user.role || "reviewer"),
      message: body.reviewNote.trim().slice(0, 4000),
      type: "approval_note" as const,
      createdAt: now,
    });
    doc.set("reviewComments", comments);
  }

  applyDefaultShowInPublicPortfolioWhenPublished(doc);
};

export type CertificateIssuerKind = "admin" | "principal" | "activitySupervisor" | "judge";

export const issuerKindFromReviewerRole = (reviewerRole: string): CertificateIssuerKind => {
  const r = String(reviewerRole || "");
  if (r === "admin") return "admin";
  if (r === "schoolAdmin") return "principal";
  if (r === "teacher" || r === "supervisor") return "activitySupervisor";
  if (r === "judge") return "judge";
  return "activitySupervisor";
};
