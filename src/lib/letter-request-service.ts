import crypto from "crypto";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import LetterRequest, {
  type ILetterRequest,
  type LetterRequestStatus,
  type LetterStudentSnapshot,
} from "@/models/LetterRequest";
import type { IUser } from "@/models/User";
import Achievement from "@/models/Achievement";

export const buildStudentSnapshotFromUser = (u: IUser): LetterStudentSnapshot => {
  const fullNameAr = typeof u.fullNameAr === "string" ? u.fullNameAr.trim() : "";
  const fullNameEn = typeof u.fullNameEn === "string" ? u.fullNameEn.trim() : "";
  const fullName = (fullNameAr || fullNameEn || u.fullName || "").trim() || "—";
  return {
    fullName,
    fullNameAr: fullNameAr || undefined,
    fullNameEn: fullNameEn || undefined,
    studentId: typeof u.studentId === "string" ? u.studentId : undefined,
    grade: typeof u.grade === "string" ? u.grade : undefined,
    section: typeof u.section === "string" ? u.section : undefined,
    gender: typeof u.gender === "string" ? u.gender : undefined,
  };
};

export const fetchApprovedAchievementsSummary = async (
  userId: mongoose.Types.ObjectId,
  language: "ar" | "en"
): Promise<string> => {
  await connectDB();
  const rows = await Achievement.find({
    userId,
    status: "approved",
  })
    .select("title nameAr nameEn achievementYear")
    .sort({ updatedAt: -1 })
    .limit(15)
    .lean();

  if (!rows.length) {
    return language === "ar" ? "لا توجد إنجازات معتمدة مسجلة في المنصة." : "No approved achievements recorded on the platform.";
  }

  const lines = rows.map((r) => {
    const title =
      language === "ar"
        ? (typeof r.nameAr === "string" && r.nameAr.trim()) || (typeof r.title === "string" && r.title.trim()) || "—"
        : (typeof r.nameEn === "string" && r.nameEn.trim()) || (typeof r.title === "string" && r.title.trim()) || "—";
    const y = r.achievementYear != null ? String(r.achievementYear) : "";
    return y ? `${title} (${y})` : title;
  });

  return language === "ar" ? `إنجازات معتمدة (عناوين فقط): ${lines.join("؛ ")}` : `Approved achievement titles: ${lines.join("; ")}`;
};

export const newVerificationToken = (): string => crypto.randomBytes(24).toString("hex");

export const appendLetterStatusHistory = async (
  doc: ILetterRequest,
  actor: IUser & { _id?: mongoose.Types.ObjectId },
  action: string,
  fromStatus: LetterRequestStatus | undefined,
  toStatus: LetterRequestStatus | undefined,
  note?: string
): Promise<void> => {
  doc.statusHistory.push({
    at: new Date(),
    actorUserId: actor._id as mongoose.Types.ObjectId | undefined,
    actorRole: String(actor.role || ""),
    action,
    fromStatus,
    toStatus,
    note,
  });
};

export const studentMetaLine = (snap: LetterStudentSnapshot, lang: "ar" | "en"): string => {
  const parts: string[] = [];
  if (snap.studentId) parts.push(lang === "ar" ? `الرقم الأكاديمي: ${snap.studentId}` : `Student ID: ${snap.studentId}`);
  if (snap.grade) parts.push(lang === "ar" ? `الصف: ${snap.grade}` : `Grade: ${snap.grade}`);
  if (snap.section) parts.push(lang === "ar" ? `المسار: ${snap.section}` : `Track: ${snap.section}`);
  return parts.join(lang === "ar" ? " — " : " — ");
};

