import "server-only";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import User from "@/models/User";
import StudentCareerProfile from "@/models/StudentCareerProfile";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import PartnerOrganization from "@/models/PartnerOrganization";
import { getStageByGrade } from "@/lib/report-stage-mapping";
import type { CertificationIssue } from "@/lib/certification/platform-certification-types";

const pushIssue = (
  issues: CertificationIssue[],
  input: Omit<CertificationIssue, "domain"> & { domain?: string }
) => {
  issues.push({ domain: input.domain || "data_quality", ...input });
};

export const runDataQualityChecks = async (): Promise<{
  issueCount: number;
  issues: CertificationIssue[];
  summary: Record<string, number>;
}> => {
  await connectDB();
  const issues: CertificationIssue[] = [];
  const summary: Record<string, number> = {};

  const studentsWithoutStage = await User.find({
    role: "student",
    $or: [{ grade: { $exists: false } }, { grade: null }, { grade: "" }],
  })
    .select("_id fullNameAr fullNameEn grade")
    .limit(150)
    .lean();

  for (const row of studentsWithoutStage) {
    pushIssue(issues, {
      code: "student_without_stage",
      severity: "medium",
      entityType: "User",
      entityId: String(row._id),
      messageAr: "طالب بلا صف/مرحلة محددة",
      messageEn: "Student without grade/stage",
      evidence: String(row.fullNameAr || row.fullNameEn || row._id),
    });
  }
  summary.student_without_stage = studentsWithoutStage.length;

  const studentsUnknownStage = await User.find({
    role: "student",
    grade: { $exists: true, $nin: [null, ""] },
  })
    .select("_id grade fullNameAr")
    .limit(500)
    .lean();
  let unknownStageCount = 0;
  for (const row of studentsUnknownStage) {
    if (getStageByGrade(row.grade) === "unknown") {
      unknownStageCount += 1;
      if (issues.filter((i) => i.code === "student_unknown_stage").length < 50) {
        pushIssue(issues, {
          code: "student_unknown_stage",
          severity: "low",
          entityType: "User",
          entityId: String(row._id),
          messageAr: `طالب بمرحلة غير معروفة (${row.grade})`,
          messageEn: `Student with unmapped grade (${row.grade})`,
        });
      }
    }
  }
  summary.student_unknown_stage = unknownStageCount;

  const incompleteAchievements = await Achievement.find({
    status: { $in: ["pending", "pending_review", "needs_revision"] },
    $or: [
      { achievementType: { $in: [null, ""] } },
      { achievementLevel: { $in: [null, ""] } },
      { participationType: { $in: [null, ""] } },
      { resultType: { $in: [null, ""] } },
    ],
  })
    .select("_id achievementType achievementLevel status")
    .limit(100)
    .lean();

  for (const row of incompleteAchievements) {
    pushIssue(issues, {
      code: "incomplete_achievement",
      severity: "medium",
      entityType: "Achievement",
      entityId: String(row._id),
      messageAr: "إنجاز ناقص الحقول الأساسية",
      messageEn: "Achievement missing required core fields",
      evidence: String(row.achievementType || "unknown"),
    });
  }
  summary.incomplete_achievement = incompleteAchievements.length;

  const orphanCertificates = await Achievement.find({
    certificateIssued: true,
    $or: [{ certificateId: { $exists: false } }, { certificateId: null }, { certificateId: "" }],
  })
    .select("_id")
    .limit(100)
    .lean();

  for (const row of orphanCertificates) {
    pushIssue(issues, {
      code: "certificate_unlinked",
      severity: "high",
      entityType: "Achievement",
      entityId: String(row._id),
      messageAr: "شهادة مُعلَنة بلا معرّف مرتبط",
      messageEn: "Certificate flagged but no certificateId linked",
    });
  }
  summary.certificate_unlinked = orphanCertificates.length;

  const opportunities = await TrainingOpportunity.find()
    .select("_id organizationId title")
    .limit(500)
    .lean();
  const orgIds = new Set(
    (await PartnerOrganization.find().select("_id").lean()).map((o) => String(o._id))
  );
  let trainingWithoutOrg = 0;
  for (const opp of opportunities) {
    if (!opp.organizationId || !orgIds.has(String(opp.organizationId))) {
      trainingWithoutOrg += 1;
      if (issues.filter((i) => i.code === "training_without_organization").length < 50) {
        pushIssue(issues, {
          code: "training_without_organization",
          severity: "high",
          entityType: "TrainingOpportunity",
          entityId: String(opp._id),
          messageAr: "فرصة تدريب بلا مؤسسة صالحة",
          messageEn: "Training opportunity without valid organization",
          evidence: String(opp.title || ""),
        });
      }
    }
  }
  summary.training_without_organization = trainingWithoutOrg;

  const activeStudents = await User.countDocuments({ role: "student" });
  const careerProfiles = await StudentCareerProfile.countDocuments();
  const studentsWithoutProfile = Math.max(0, activeStudents - careerProfiles);
  summary.students_without_career_profile = studentsWithoutProfile;

  if (studentsWithoutProfile > 0 && activeStudents > 0) {
    const pct = Math.round((studentsWithoutProfile / activeStudents) * 100);
    if (pct > 30) {
      pushIssue(issues, {
        code: "incomplete_career_profiles",
        severity: pct > 60 ? "medium" : "low",
        messageAr: `${studentsWithoutProfile} طالب (${pct}%) بلا ملف مهني`,
        messageEn: `${studentsWithoutProfile} students (${pct}%) without career profile`,
        evidence: `totalStudents=${activeStudents}, profiles=${careerProfiles}`,
      });
    }
  }

  const sparseProfiles = await StudentCareerProfile.find({
    $and: [
      { careerReadinessScore: { $lte: 0 } },
      { universityReadinessScore: { $lte: 0 } },
      { extractedSkills: { $size: 0 } },
      { manualSkills: { $size: 0 } },
      { professionalBio: { $in: [null, ""] } },
    ],
  })
    .select("_id studentId")
    .limit(80)
    .lean();

  for (const row of sparseProfiles) {
    pushIssue(issues, {
      code: "sparse_career_profile",
      severity: "low",
      entityType: "StudentCareerProfile",
      entityId: String(row._id),
      messageAr: "ملف مهني فارغ أو ناقص البيانات",
      messageEn: "Career profile empty or missing data",
    });
  }
  summary.sparse_career_profile = sparseProfiles.length;

  return {
    issueCount: issues.length,
    issues: issues.slice(0, 200),
    summary,
  };
};
