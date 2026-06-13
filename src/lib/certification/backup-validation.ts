import "server-only";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import User from "@/models/User";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingCompletionRecord from "@/models/TrainingCompletionRecord";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import StudentCareerProfile from "@/models/StudentCareerProfile";
import VolunteerRecord from "@/models/VolunteerRecord";
import PartnershipProgramSettings from "@/models/PartnershipProgramSettings";
import type { BackupValidationResult, CertificationIssue } from "@/lib/certification/platform-certification-types";

const BSON_DOC_LIMIT_BYTES = 16 * 1024 * 1024;

export const runBackupValidation = async (): Promise<BackupValidationResult> => {
  await connectDB();
  const issues: CertificationIssue[] = [];

  const [
    achievements,
    users,
    applications,
    opportunities,
    reports,
    profiles,
    volunteers,
    settings,
  ] = await Promise.all([
    Achievement.countDocuments(),
    User.countDocuments(),
    StudentTrainingApplication.countDocuments(),
    TrainingOpportunity.countDocuments(),
    TrainingCompletionRecord.countDocuments(),
    StudentCareerProfile.countDocuments(),
    VolunteerRecord.countDocuments(),
    PartnershipProgramSettings.findOne({ singletonKey: "default" }).select("lastBackupSnapshotAt backupIntegrationEnabled").lean(),
  ]);

  const collectionCounts = {
    achievements,
    users,
    applications,
    opportunities,
    reports,
    profiles,
    volunteers,
  };

  const snapshotMarkerAt = settings?.lastBackupSnapshotAt
    ? new Date(settings.lastBackupSnapshotAt).toISOString()
    : null;

  if (!snapshotMarkerAt) {
    issues.push({
      code: "no_backup_marker",
      severity: "medium",
      domain: "backup",
      messageAr: "لا توجد علامة لقطة نسخ احتياطي مسجّلة",
      messageEn: "No backup snapshot marker registered",
    });
  }

  const sampleDocs = await Promise.all([
    Achievement.findOne().lean(),
    User.findOne({ role: "student" }).lean(),
    StudentTrainingApplication.findOne().lean(),
    StudentCareerProfile.findOne().lean(),
  ]);

  let restoreSimulationOk = true;
  for (const doc of sampleDocs) {
    if (!doc) continue;
    const serialized = JSON.stringify(doc);
    if (serialized.length > BSON_DOC_LIMIT_BYTES) {
      restoreSimulationOk = false;
      issues.push({
        code: "document_exceeds_bson_limit",
        severity: "critical",
        domain: "backup",
        messageAr: "عينة مستند تتجاوز حد BSON — قد تفشل الاستعادة",
        messageEn: "Sample document exceeds BSON limit — restore may fail",
        evidence: `${serialized.length} bytes`,
      });
    }
    if (!doc._id) {
      restoreSimulationOk = false;
    }
  }

  const totalDocs = Object.values(collectionCounts).reduce((s, n) => s + n, 0);
  if (totalDocs === 0) {
    issues.push({
      code: "empty_database",
      severity: "high",
      domain: "backup",
      messageAr: "قاعدة البيانات فارغة — لا يمكن التحقق من الاستعادة",
      messageEn: "Database empty — cannot validate restore simulation",
    });
    restoreSimulationOk = false;
  }

  return {
    ok: issues.filter((i) => i.severity === "critical" || i.severity === "high").length === 0,
    snapshotMarkerAt,
    collectionCounts,
    restoreSimulationOk,
    issues,
    noteAr: "محاكاة استعادة للقراءة فقط — لا تعديل على الإنتاج",
    noteEn: "Read-only restore simulation — no production mutation",
  };
};
