import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import StudentCareerProfile from "@/models/StudentCareerProfile";
import TrainingCompletionRecord from "@/models/TrainingCompletionRecord";
import User from "@/models/User";
import VolunteerRecord from "@/models/VolunteerRecord";
import { resolveAcademicYearForLegacyRecord } from "@/lib/academic-years/academic-year-display";
import { getGradeLabel } from "@/constants/grades";
import { buildStudentAchievementSummary } from "@/lib/partnerships/build-student-achievement-summary";

export type InstitutionStudentProfileSummary = {
  basic: {
    fullName: string;
    grade: string;
    gradeLabelAr: string;
    gradeLabelEn: string;
    stage: string;
    school: string;
    academicYearLabel: string;
  };
  achievements: {
    totalCount: number;
    certificateCount: number;
    recent: Array<{ title: string; outcome: string; year: string }>;
    highlights: Array<{ title: string; outcome: string; year: string }>;
  };
  volunteer: {
    totalHours: number;
    participationCount: number;
  };
  priorTraining: Array<{
    organizationName: string;
    status: string;
    volunteerHours: number;
    trainingStart: string | null;
    trainingEnd: string | null;
  }>;
  careerReadiness: {
    careerReadinessScore: number;
    universityReadinessScore: number;
    trainingHours: number;
    volunteerHours: number;
  };
  interests: {
    careerInterests: string[];
    professionalInterests: string[];
    specializations: string[];
  };
};

const stageFromGrade = (grade: string): string => {
  const num = parseInt(String(grade || "").replace(/\D/g, ""), 10);
  if (num >= 1 && num <= 6) return "elementary";
  if (num >= 7 && num <= 9) return "middle";
  if (num >= 10 && num <= 12) return "high";
  return "";
};

export const buildInstitutionStudentProfileSummary = async (
  studentId: string,
  snapshot?: {
    fullName?: string;
    grade?: string;
    stage?: string;
    school?: string;
    academicYear?: string;
    academicYearLabel?: string;
  },
  locale: "ar" | "en" = "ar"
): Promise<InstitutionStudentProfileSummary> => {
  await connectDB();

  const [user, careerProfile, achievementSummary, volunteerRows, trainingRows, certificateCount] =
    await Promise.all([
      mongoose.Types.ObjectId.isValid(studentId)
        ? User.findById(studentId).select("fullName fullNameAr fullNameEn grade section").lean()
        : null,
      mongoose.Types.ObjectId.isValid(studentId)
        ? StudentCareerProfile.findOne({ studentId: new mongoose.Types.ObjectId(studentId) }).lean()
        : null,
      buildStudentAchievementSummary(studentId, locale),
      mongoose.Types.ObjectId.isValid(studentId)
        ? VolunteerRecord.find({ studentId: new mongoose.Types.ObjectId(studentId) })
            .select("hours status")
            .lean()
        : [],
      mongoose.Types.ObjectId.isValid(studentId)
        ? TrainingCompletionRecord.find({ studentId: new mongoose.Types.ObjectId(studentId) })
            .sort({ trainingEndDate: -1, createdAt: -1 })
            .limit(8)
            .lean()
        : [],
      mongoose.Types.ObjectId.isValid(studentId)
        ? Achievement.countDocuments({
            userId: new mongoose.Types.ObjectId(studentId),
            approved: true,
            certificateIssuedAt: { $exists: true, $ne: null },
          })
        : 0,
    ]);

  const grade = String(snapshot?.grade || user?.grade || "").trim();
  const academicYearLabel = await resolveAcademicYearForLegacyRecord({
    academicYear: snapshot?.academicYear,
    academicYearLabel: snapshot?.academicYearLabel,
  });

  const recent = achievementSummary.items.slice(0, 3);
  const highlights = achievementSummary.items
    .filter((row) => row.resultType === "medal" || row.level === "national" || row.level === "international")
    .slice(0, 3);

  const volunteerHours = volunteerRows.reduce((sum, row) => sum + (Number(row.hours) || 0), 0);

  return {
    basic: {
      fullName: String(snapshot?.fullName || user?.fullNameAr || user?.fullName || "").trim(),
      grade,
      gradeLabelAr: getGradeLabel(grade, "ar"),
      gradeLabelEn: getGradeLabel(grade, "en"),
      stage: String(snapshot?.stage || stageFromGrade(grade)),
      school: String(snapshot?.school || (user?.section === "international" ? "International" : "Arabic")),
      academicYearLabel,
    },
    achievements: {
      totalCount: achievementSummary.totalAchievements,
      certificateCount,
      recent,
      highlights: highlights.length > 0 ? highlights : recent.slice(0, 2),
    },
    volunteer: {
      totalHours: volunteerHours,
      participationCount: volunteerRows.length,
    },
    priorTraining: trainingRows.map((row) => ({
      organizationName: String(row.organizationName || ""),
      status: String(row.status || ""),
      volunteerHours: Number(row.volunteerHours) || 0,
      trainingStart: row.trainingStartDate ? new Date(row.trainingStartDate).toISOString() : null,
      trainingEnd: row.trainingEndDate ? new Date(row.trainingEndDate).toISOString() : null,
    })),
    careerReadiness: {
      careerReadinessScore: Number(careerProfile?.careerReadinessScore) || 0,
      universityReadinessScore: Number(careerProfile?.universityReadinessScore) || 0,
      trainingHours: Number(careerProfile?.trainingHours) || 0,
      volunteerHours: Number(careerProfile?.volunteerHours) || volunteerHours,
    },
    interests: {
      careerInterests: Array.isArray(careerProfile?.careerInterests) ? careerProfile.careerInterests : [],
      professionalInterests: [
        ...(Array.isArray(careerProfile?.manualSkills) ? careerProfile.manualSkills : []),
        ...(Array.isArray(careerProfile?.extractedSkills) ? careerProfile.extractedSkills : []),
      ],
      specializations: Array.isArray(careerProfile?.targetMajors) ? careerProfile.targetMajors : [],
    },
  };
};
