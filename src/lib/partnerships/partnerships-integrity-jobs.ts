import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingCompletionRecord from "@/models/TrainingCompletionRecord";
import { UI_CATEGORY_SUMMER_TRAINING } from "@/constants/achievement-special-categories";

export type IntegrityIssue = {
  code: string;
  severity: "high" | "medium" | "low";
  entityType: string;
  entityId: string;
  messageAr: string;
  messageEn: string;
};

export const runPartnershipIntegrityChecks = async (): Promise<{
  checkedAt: string;
  issueCount: number;
  issues: IntegrityIssue[];
}> => {
  await connectDB();
  const issues: IntegrityIssue[] = [];

  const approvedWithoutAchievement = await TrainingCompletionRecord.find({
    status: "approved",
    $or: [{ achievementId: { $exists: false } }, { achievementId: null }],
  })
    .select("_id applicationId studentId")
    .limit(200)
    .lean();

  for (const row of approvedWithoutAchievement) {
    issues.push({
      code: "approved_report_without_achievement",
      severity: "high",
      entityType: "TrainingCompletionRecord",
      entityId: String(row._id),
      messageAr: "تقرير معتمد بلا إنجاز مرتبط",
      messageEn: "Approved report without linked achievement",
    });
  }

  const approvedRecords = await TrainingCompletionRecord.find({
    status: "approved",
    achievementId: { $exists: true, $ne: null },
  })
    .select("achievementId")
    .limit(300)
    .lean();
  const achievementIds = approvedRecords
    .map((row) => row.achievementId)
    .filter((id): id is NonNullable<typeof id> => Boolean(id));

  if (achievementIds.length > 0) {
    const achievements = await Achievement.find({ _id: { $in: achievementIds } })
      .select("certificateIssued certificateId")
      .lean();
    const achievementMap = new Map(achievements.map((row) => [String(row._id), row]));
    for (const record of approvedRecords) {
      const ach = achievementMap.get(String(record.achievementId));
      if (!ach || ach.certificateIssued !== true) {
        issues.push({
          code: "approved_report_without_certificate",
          severity: "high",
          entityType: "TrainingCompletionRecord",
          entityId: String(record._id),
          messageAr: "تقرير معتمد بلا شهادة",
          messageEn: "Approved report without certificate",
        });
      }
    }
  }

  const completedWithoutReport = await StudentTrainingApplication.find({
    status: "completed",
    archived: { $ne: true },
  })
    .select("_id")
    .limit(300)
    .lean();
  const completedIds = completedWithoutReport.map((row) => row._id);
  const reports = await TrainingCompletionRecord.find({
    applicationId: { $in: completedIds },
    status: "approved",
  })
    .select("applicationId")
    .lean();
  const reportedSet = new Set(reports.map((row) => String(row.applicationId)));
  for (const app of completedWithoutReport) {
    if (!reportedSet.has(String(app._id))) {
      issues.push({
        code: "completed_application_without_report",
        severity: "medium",
        entityType: "StudentTrainingApplication",
        entityId: String(app._id),
        messageAr: "طلب مكتمل بلا تقرير معتمد",
        messageEn: "Completed application without approved report",
      });
    }
  }

  const orphanCertificates = await Achievement.find({
    achievementType: UI_CATEGORY_SUMMER_TRAINING,
    certificateIssued: true,
    adminWorkflowNote: { $not: /^summer_training_record:/ },
  })
    .select("_id")
    .limit(100)
    .lean();
  for (const row of orphanCertificates) {
    issues.push({
      code: "certificate_without_training_record_link",
      severity: "medium",
      entityType: "Achievement",
      entityId: String(row._id),
      messageAr: "شهادة تدريب بلا ربط بتقرير",
      messageEn: "Training certificate without report link",
    });
  }

  return {
    checkedAt: new Date().toISOString(),
    issueCount: issues.length,
    issues,
  };
};
