import "server-only";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import Notification from "@/models/Notification";
import type { IntelligenceAlertLevel } from "@/models/IntelligenceHealthAlert";

export const notifySystemAdminsOfCriticalAlert = async (input: {
  titleAr: string;
  titleEn: string;
  messageAr: string;
  messageEn: string;
  alertKey: string;
  level: IntelligenceAlertLevel;
}) => {
  if (input.level !== "critical") return;

  await connectDB();
  const admins = await User.find({ role: "admin", status: "active" })
    .select("_id preferredLocale")
    .lean();

  if (admins.length === 0) return;

  const recentCutoff = new Date(Date.now() - 6 * 60 * 60 * 1000);
  await Promise.all(
    admins.map(async (admin) => {
      const duplicate = await Notification.findOne({
        userId: admin._id,
        type: "system",
        "metadata.alertKey": input.alertKey,
        createdAt: { $gte: recentCutoff },
      })
        .select("_id")
        .lean();
      if (duplicate) return;

      const isAr = String((admin as { preferredLocale?: string }).preferredLocale || "ar") === "ar";
      await Notification.create({
        userId: admin._id,
        type: "system",
        title: isAr ? input.titleAr : input.titleEn,
        message: isAr ? input.messageAr : input.messageEn,
        read: false,
        metadata: {
          alertKey: input.alertKey,
          level: input.level,
          domain: "intelligence_health",
        },
      });
    })
  );
};
