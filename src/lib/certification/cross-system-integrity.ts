import "server-only";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import User from "@/models/User";
import StudentCareerProfile from "@/models/StudentCareerProfile";
import VolunteerRecord from "@/models/VolunteerRecord";
import TrainingCompletionRecord from "@/models/TrainingCompletionRecord";
import { runPartnershipIntegrityChecks } from "@/lib/partnerships/partnerships-integrity-jobs";
import type { CertificationIssue } from "@/lib/certification/platform-certification-types";

const toCertIssue = (input: {
  code: string;
  severity: CertificationIssue["severity"];
  entityType?: string;
  entityId?: string;
  messageAr: string;
  messageEn: string;
  evidence?: string;
}): CertificationIssue => ({
  domain: "cross_system",
  ...input,
});

export const runCrossSystemIntegrityChecks = async (): Promise<{
  issueCount: number;
  issues: CertificationIssue[];
}> => {
  await connectDB();
  const issues: CertificationIssue[] = [];

  const partnershipResult = await runPartnershipIntegrityChecks();
  for (const row of partnershipResult.issues) {
    issues.push(
      toCertIssue({
        code: `partnership_${row.code}`,
        severity: row.severity === "high" ? "high" : row.severity === "medium" ? "medium" : "low",
        entityType: row.entityType,
        entityId: row.entityId,
        messageAr: row.messageAr,
        messageEn: row.messageEn,
      })
    );
  }

  const profiles = await StudentCareerProfile.find().select("studentId").limit(500).lean();
  const profileStudentIds = profiles.map((p) => p.studentId).filter(Boolean);
  if (profileStudentIds.length > 0) {
    const existingUsers = await User.find({ _id: { $in: profileStudentIds } })
      .select("_id")
      .lean();
    const userSet = new Set(existingUsers.map((u) => String(u._id)));
    for (const profile of profiles) {
      if (!userSet.has(String(profile.studentId))) {
        issues.push(
          toCertIssue({
            code: "career_profile_orphan_student",
            severity: "high",
            entityType: "StudentCareerProfile",
            entityId: String(profile._id),
            messageAr: "ملف مهني مرتبط بطالب غير موجود",
            messageEn: "Career profile linked to missing student",
          })
        );
      }
    }
  }

  const volunteerRows = await VolunteerRecord.find().select("studentId").limit(300).lean();
  const volunteerStudentIds = [...new Set(volunteerRows.map((v) => String(v.studentId)))];
  if (volunteerStudentIds.length > 0) {
    const volunteerUsers = await User.find({
      _id: { $in: volunteerStudentIds },
    })
      .select("_id")
      .lean();
    const volunteerUserSet = new Set(volunteerUsers.map((u) => String(u._id)));
    for (const row of volunteerRows) {
      if (!volunteerUserSet.has(String(row.studentId))) {
        issues.push(
          toCertIssue({
            code: "volunteer_orphan_student",
            severity: "medium",
            entityType: "VolunteerRecord",
            entityId: String(row._id),
            messageAr: "سجل تطوع مرتبط بطالب غير موجود",
            messageEn: "Volunteer record linked to missing student",
          })
        );
      }
    }
  }

  const trainingWithAchievement = await TrainingCompletionRecord.find({
    achievementId: { $exists: true, $ne: null },
  })
    .select("achievementId _id")
    .limit(200)
    .lean();
  const achIds = trainingWithAchievement
    .map((r) => r.achievementId)
    .filter((id): id is NonNullable<typeof id> => Boolean(id));
  if (achIds.length > 0) {
    const achievements = await Achievement.find({ _id: { $in: achIds } }).select("_id").lean();
    const achSet = new Set(achievements.map((a) => String(a._id)));
    for (const record of trainingWithAchievement) {
      if (!achSet.has(String(record.achievementId))) {
        issues.push(
          toCertIssue({
            code: "training_broken_achievement_link",
            severity: "high",
            entityType: "TrainingCompletionRecord",
            entityId: String(record._id),
            messageAr: "تقرير تدريب مرتبط بإنجاز محذوف",
            messageEn: "Training report linked to missing achievement",
          })
        );
      }
    }
  }

  const portfolioUsers = await User.find({
    publicPortfolioEnabled: true,
    $or: [
      { publicPortfolioSlug: { $exists: false } },
      { publicPortfolioSlug: null },
      { publicPortfolioSlug: "" },
    ],
  })
    .select("_id")
    .limit(50)
    .lean();

  for (const row of portfolioUsers) {
    issues.push(
      toCertIssue({
        code: "portfolio_enabled_without_slug",
        severity: "medium",
        entityType: "User",
        entityId: String(row._id),
        messageAr: "ملف إنجاز عام مفعّل بلا رابط عام",
        messageEn: "Public portfolio enabled without slug",
      })
    );
  }

  const approvedAchievements = await Achievement.find({
    status: "approved",
    userId: { $exists: true, $ne: null },
    showInPublicPortfolio: true,
  })
    .select("userId _id")
    .limit(300)
    .lean();
  const approvedUserIds = [...new Set(approvedAchievements.map((a) => String(a.userId)))];
  if (approvedUserIds.length > 0) {
    const usersWithPortfolio = await User.find({
      _id: { $in: approvedUserIds },
      publicPortfolioEnabled: true,
    })
      .select("_id")
      .lean();
    const enabledSet = new Set(usersWithPortfolio.map((u) => String(u._id)));
    let mismatchCount = 0;
    for (const ach of approvedAchievements) {
      if (!enabledSet.has(String(ach.userId))) {
        mismatchCount += 1;
      }
    }
    if (mismatchCount > 0) {
      issues.push(
        toCertIssue({
          code: "portfolio_achievement_visibility_mismatch",
          severity: "low",
          messageAr: `${mismatchCount} إنجاز معروض بلا ملف عام مفعّل للطالب`,
          messageEn: `${mismatchCount} portfolio-visible achievements without enabled public portfolio`,
          evidence: `sampled=${approvedAchievements.length}`,
        })
      );
    }
  }

  return {
    issueCount: issues.length,
    issues: issues.slice(0, 250),
  };
};
