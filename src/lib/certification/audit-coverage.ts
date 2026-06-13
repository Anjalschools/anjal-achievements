import "server-only";
import connectDB from "@/lib/mongodb";
import AuditLog from "@/models/AuditLog";
import { auditActionLabel } from "@/lib/audit-log-display";
import type { AuditCoverageItem } from "@/lib/certification/platform-certification-types";

const CRITICAL_ACTION_TYPES = [
  "achievement_created",
  "achievement_updated",
  "certificate_issued",
  "training_application_accepted",
  "training_application_rejected",
  "training_report_approved",
  "training_report_rejected",
  "partnerships_integrity_scan",
  "partnerships_archive_executed",
  "partnerships_settings_updated",
  "news_published_website",
  "admin_settings_updated",
  "user_public_portfolio_updated",
  "platform_certification_scan",
] as const;

export const runAuditCoverageCheck = async (): Promise<{
  items: AuditCoverageItem[];
  coveragePct: number;
  gaps: string[];
}> => {
  await connectDB();
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const items: AuditCoverageItem[] = [];
  const gaps: string[] = [];

  for (const actionType of CRITICAL_ACTION_TYPES) {
    const labelAr = auditActionLabel(actionType, true);
    const labelEn = auditActionLabel(actionType, false);
    const registered = labelAr !== actionType.replace(/_/g, " ");
    const recentEventCount = await AuditLog.countDocuments({
      actionType,
      createdAt: { $gte: since },
    });
    const covered = registered;
    if (!covered) gaps.push(actionType);
    items.push({
      actionType,
      labelAr,
      labelEn,
      registered,
      recentEventCount,
      covered,
    });
  }

  const coveredCount = items.filter((i) => i.covered).length;
  const coveragePct = items.length > 0 ? Math.round((coveredCount / items.length) * 100) : 100;

  return { items, coveragePct, gaps };
};
