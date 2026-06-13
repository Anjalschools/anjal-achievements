import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import { applyAcademicYearCreateFields } from "@/lib/academic-years/academic-year-integration";
import StudentCareerProfile from "@/models/StudentCareerProfile";
import TrainingCompletionRecord from "@/models/TrainingCompletionRecord";
import User from "@/models/User";
import VolunteerRecord from "@/models/VolunteerRecord";
import { loadStudentActivityBundle } from "@/lib/analytics/ai/activity-intelligence/student-activity-loader";
import {
  buildStudentAchievementSummary,
  type StudentAchievementSummary,
} from "@/lib/partnerships/build-student-achievement-summary";
import {
  generateCareerInsight,
  generateSkillGapAnalysis,
  generateUniversityInsight,
} from "@/lib/career/career-ai-insights";
import {
  buildCareerRecommendations,
  type CareerRecommendation,
} from "@/lib/career/career-recommendations";
import { computeAllCareerScores } from "@/lib/career/career-readiness-scoring";
import { extractCareerSkills } from "@/lib/career/career-skill-extraction";
import { getPartnershipStudentPortfolioAccess } from "@/lib/partnerships/partnerships-portfolio-access";
import { normalizeStudentPortfolioContentFromDoc } from "@/lib/student-portfolio-content";
import { getGradeLabel } from "@/constants/grades";
import type { CareerPublicVisibility } from "@/models/StudentCareerProfile";

export type CareerTrainingRecord = {
  id: string;
  organizationName: string;
  volunteerHours: number;
  trainingStart: string | null;
  trainingEnd: string | null;
  status: string;
  assignedTasks: string;
  studentReflection: string;
  avgRating: number | null;
};

export type CareerVolunteerRecord = {
  id: string;
  title: string;
  organization: string;
  hours: number;
  status: string;
  academicYear: string;
  startDate: string | null;
  endDate: string | null;
};

export type CareerCertificateItem = {
  id: string;
  title: string;
  verificationPath: string | null;
  year: string;
};

export type StudentCareerProfilePayload = {
  profile: {
    studentId: string;
    fullName: string;
    fullNameEn: string;
    grade: string;
    gradeLabelAr: string;
    gradeLabelEn: string;
    section: string;
    profilePhoto: string | null;
  };
  editable: {
    professionalBio: string;
    professionalBioEn: string;
    careerInterests: string[];
    targetMajors: string[];
    manualSkills: string[];
    publicVisibility: CareerPublicVisibility;
  };
  scores: {
    careerReadinessScore: number;
    universityReadinessScore: number;
    volunteerHours: number;
    trainingHours: number;
    achievementsScore: number;
    leadershipScore: number;
    skillsScore: number;
    computedAt: string | null;
  };
  skills: string[];
  achievements: StudentAchievementSummary;
  training: CareerTrainingRecord[];
  volunteer: CareerVolunteerRecord[];
  certificates: CareerCertificateItem[];
  portfolio: ReturnType<typeof normalizeStudentPortfolioContentFromDoc>;
  recommendations: CareerRecommendation[];
  insights: {
    career: string;
    university: string;
    skillGap: string;
  };
  publicPortfolioUrl: string | null;
  generatedAt: string;
};

const defaultVisibility = (): CareerPublicVisibility => ({
  showAchievements: true,
  showTraining: false,
  showVolunteer: false,
  showResume: false,
});

const ensureCareerProfile = async (studentId: mongoose.Types.ObjectId) => {
  let row = await StudentCareerProfile.findOne({ studentId });
  if (!row) {
    const seed: {
      studentId: mongoose.Types.ObjectId;
      academicYear?: string;
      academicYearId?: mongoose.Types.ObjectId;
      academicYearLabel?: string;
    } = { studentId };
    try {
      await applyAcademicYearCreateFields(seed);
    } catch {
      /* optional when no current academic year */
    }
    row = await StudentCareerProfile.create(seed);
  }
  return row;
};

const loadTrainingRecords = async (studentId: mongoose.Types.ObjectId): Promise<CareerTrainingRecord[]> => {
  const rows = await TrainingCompletionRecord.find({
    studentId,
    status: { $in: ["approved", "submitted", "under_review"] },
  })
    .sort({ submittedAt: -1, updatedAt: -1 })
    .limit(20)
    .lean();

  return rows.map((row) => {
    const ratings = [
      row.studentBenefitRating,
      row.attendanceCommitment,
      row.professionalEthics,
      row.safetyCompliance,
      row.overallRecommendation,
    ].filter((v): v is number => typeof v === "number" && v > 0);
    const avgRating =
      ratings.length > 0 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null;
    return {
      id: String(row._id),
      organizationName: row.organizationName || "",
      volunteerHours: Number(row.volunteerHours || 0),
      trainingStart: row.trainingStartDate ? new Date(row.trainingStartDate).toISOString().slice(0, 10) : null,
      trainingEnd: row.trainingEndDate ? new Date(row.trainingEndDate).toISOString().slice(0, 10) : null,
      status: String(row.status),
      assignedTasks: row.assignedTasks || "",
      studentReflection: row.studentReflection || "",
      avgRating,
    };
  });
};

const loadVolunteerRecords = async (studentId: mongoose.Types.ObjectId): Promise<CareerVolunteerRecord[]> => {
  const rows = await VolunteerRecord.find({ studentId }).sort({ createdAt: -1 }).limit(30).lean();
  return rows.map((row) => ({
    id: String(row._id),
    title: row.title,
    organization: row.organization,
    hours: Number(row.hours || 0),
    status: String(row.status),
    academicYear: row.academicYear,
    startDate: row.startDate ? new Date(row.startDate).toISOString().slice(0, 10) : null,
    endDate: row.endDate ? new Date(row.endDate).toISOString().slice(0, 10) : null,
  }));
};

const loadCertificates = async (studentId: mongoose.Types.ObjectId): Promise<CareerCertificateItem[]> => {
  const rows = await Achievement.find({
    userId: studentId,
    certificateIssued: true,
    $or: [{ status: "approved" }, { approved: true }],
  })
    .select("achievementName customAchievementName competitionName certificateId achievementYear createdAt")
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();

  return rows.map((row) => ({
    id: String(row._id),
    title:
      String(row.customAchievementName || row.competitionName || row.achievementName || "Certificate").trim(),
    verificationPath: row.certificateId ? `/certificates/verify/${row.certificateId}` : null,
    year: row.achievementYear ? String(row.achievementYear) : "",
  }));
};

export const buildStudentCareerProfile = async (
  studentId: string,
  opts?: { refreshScores?: boolean; locale?: "ar" | "en" }
): Promise<StudentCareerProfilePayload | null> => {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(studentId)) return null;

  const user = await User.findById(studentId).lean();
  if (!user || String(user.role) !== "student") return null;

  const sid = new mongoose.Types.ObjectId(studentId);
  const [careerDoc, activityBundle, achievementSummary, training, volunteer, certificates, portfolioAccess] =
    await Promise.all([
      ensureCareerProfile(sid),
      loadStudentActivityBundle(studentId),
      buildStudentAchievementSummary(studentId, opts?.locale || "ar"),
      loadTrainingRecords(sid),
      loadVolunteerRecords(sid),
      loadCertificates(sid),
      getPartnershipStudentPortfolioAccess(studentId),
    ]);

  const portfolio = normalizeStudentPortfolioContentFromDoc(user.studentPortfolioContent);
  const trainingHours = training.reduce((sum, r) => sum + r.volunteerHours, 0);
  const volunteerHoursFromRecords = volunteer
    .filter((r) => r.status === "approved" || r.status === "submitted")
    .reduce((sum, r) => sum + r.hours, 0);
  const portfolioVolunteerHours = (portfolio.activities || []).reduce((sum, a) => sum + (a.hours || 0), 0);
  const totalVolunteerHours = volunteerHoursFromRecords + portfolioVolunteerHours;

  const trainingRatings = training.map((r) => r.avgRating).filter((v): v is number => v != null);
  const avgTrainingRating =
    trainingRatings.length > 0
      ? trainingRatings.reduce((a, b) => a + b, 0) / trainingRatings.length
      : null;

  const extractedSkills = extractCareerSkills({
    achievementRecords: activityBundle.records,
    trainingTasks: training.map((r) => r.assignedTasks).join(" ") || undefined,
    trainingReflection: training.map((r) => r.studentReflection).join(" ") || undefined,
    portfolioTechnicalSkills: portfolio.technicalSkills,
    portfolioPersonalSkills: portfolio.personalSkills,
    portfolioActivities: portfolio.activities,
    volunteerTitles: volunteer.map((r) => r.title),
  });

  const allSkills = [...new Set([...extractedSkills, ...(careerDoc.manualSkills || [])])].slice(0, 40);

  const scoreInput = {
    achievementSummary,
    achievementRecords: activityBundle.records,
    trainingHours,
    volunteerHours: totalVolunteerHours,
    trainingCount: training.filter((r) => r.status === "approved").length,
    avgTrainingRating,
    skillCount: allSkills.length,
    initiativeCount: portfolio.activities?.length || 0,
    courseCount: portfolio.courses?.length || 0,
  };

  const scores = computeAllCareerScores(scoreInput);
  const recommendations = buildCareerRecommendations({
    skills: allSkills,
    interests: careerDoc.careerInterests || [],
    achievementSummary,
    trainingCount: scoreInput.trainingCount,
    volunteerHours: totalVolunteerHours,
    grade: user.grade,
  });

  const isAr = (opts?.locale || "ar") === "ar";
  const insights = {
    career: generateCareerInsight({
      isAr,
      universityReadinessScore: scores.universityReadinessScore,
      careerReadinessScore: scores.careerReadinessScore,
      achievementsScore: scores.achievementsScore,
      leadershipScore: scores.leadershipScore,
      skillsScore: scores.skillsScore,
      skills: allSkills,
      trainingHours,
      volunteerHours: totalVolunteerHours,
      medalCount: achievementSummary.medalCount,
      recommendations,
    }),
    university: generateUniversityInsight({
      isAr,
      universityReadinessScore: scores.universityReadinessScore,
      careerReadinessScore: scores.careerReadinessScore,
      achievementsScore: scores.achievementsScore,
      leadershipScore: scores.leadershipScore,
      skillsScore: scores.skillsScore,
      skills: allSkills,
      trainingHours,
      volunteerHours: totalVolunteerHours,
      medalCount: achievementSummary.medalCount,
      recommendations,
    }),
    skillGap: generateSkillGapAnalysis({
      isAr,
      universityReadinessScore: scores.universityReadinessScore,
      careerReadinessScore: scores.careerReadinessScore,
      achievementsScore: scores.achievementsScore,
      leadershipScore: scores.leadershipScore,
      skillsScore: scores.skillsScore,
      skills: allSkills,
      trainingHours,
      volunteerHours: totalVolunteerHours,
      medalCount: achievementSummary.medalCount,
      recommendations,
    }),
  };

  if (opts?.refreshScores !== false) {
    careerDoc.extractedSkills = extractedSkills;
    careerDoc.careerReadinessScore = scores.careerReadinessScore;
    careerDoc.universityReadinessScore = scores.universityReadinessScore;
    careerDoc.volunteerHours = totalVolunteerHours;
    careerDoc.trainingHours = trainingHours;
    careerDoc.achievementsScore = scores.achievementsScore;
    careerDoc.leadershipScore = scores.leadershipScore;
    careerDoc.skillsScore = scores.skillsScore;
    careerDoc.careerInsight = insights.career;
    careerDoc.universityInsight = insights.university;
    careerDoc.skillGapAnalysis = insights.skillGap;
    careerDoc.scoresComputedAt = new Date();
    await careerDoc.save();
  }

  const gradeLabel = getGradeLabel(user.grade, "ar");
  const gradeLabelEn = getGradeLabel(user.grade, "en");

  return {
    profile: {
      studentId,
      fullName: String(user.fullNameAr || user.fullName || "").trim(),
      fullNameEn: String(user.fullNameEn || user.fullName || user.fullNameAr || "").trim(),
      grade: String(user.grade || ""),
      gradeLabelAr: gradeLabel,
      gradeLabelEn,
      section: String(user.section || ""),
      profilePhoto: user.profilePhoto || null,
    },
    editable: {
      professionalBio: careerDoc.professionalBio || portfolio.bio || "",
      professionalBioEn: careerDoc.professionalBioEn || "",
      careerInterests: careerDoc.careerInterests || [],
      targetMajors: careerDoc.targetMajors || [],
      manualSkills: careerDoc.manualSkills || [],
      publicVisibility: {
        ...defaultVisibility(),
        ...(careerDoc.publicVisibility || {}),
      },
    },
    scores: {
      careerReadinessScore: scores.careerReadinessScore,
      universityReadinessScore: scores.universityReadinessScore,
      volunteerHours: totalVolunteerHours,
      trainingHours,
      achievementsScore: scores.achievementsScore,
      leadershipScore: scores.leadershipScore,
      skillsScore: scores.skillsScore,
      computedAt: careerDoc.scoresComputedAt?.toISOString() || null,
    },
    skills: allSkills,
    achievements: achievementSummary,
    training,
    volunteer,
    certificates,
    portfolio,
    recommendations,
    insights,
    publicPortfolioUrl: portfolioAccess.url,
    generatedAt: new Date().toISOString(),
  };
};

export const updateStudentCareerProfile = async (
  studentId: string,
  patch: Partial<{
    professionalBio: string;
    professionalBioEn: string;
    careerInterests: string[];
    targetMajors: string[];
    manualSkills: string[];
    publicVisibility: Partial<CareerPublicVisibility>;
  }>
) => {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(studentId)) throw new Error("Invalid student id");
  const doc = await ensureCareerProfile(new mongoose.Types.ObjectId(studentId));

  if (patch.professionalBio != null) doc.professionalBio = String(patch.professionalBio).trim().slice(0, 6000);
  if (patch.professionalBioEn != null) doc.professionalBioEn = String(patch.professionalBioEn).trim().slice(0, 6000);
  if (Array.isArray(patch.careerInterests)) {
    doc.careerInterests = patch.careerInterests.map((s) => String(s).trim()).filter(Boolean).slice(0, 20);
  }
  if (Array.isArray(patch.targetMajors)) {
    doc.targetMajors = patch.targetMajors.map((s) => String(s).trim()).filter(Boolean).slice(0, 15);
  }
  if (Array.isArray(patch.manualSkills)) {
    doc.manualSkills = patch.manualSkills.map((s) => String(s).trim()).filter(Boolean).slice(0, 40);
  }
  if (patch.publicVisibility) {
    doc.publicVisibility = {
      ...defaultVisibility(),
      ...(doc.publicVisibility || {}),
      ...patch.publicVisibility,
    };
  }

  await doc.save();
  return buildStudentCareerProfile(studentId);
};
