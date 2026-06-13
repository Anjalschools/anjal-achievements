import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import StudentCareerProfile from "@/models/StudentCareerProfile";
import { buildStudentCareerProfile } from "@/lib/career/student-career-profile-service";

export type PublicCareerPortfolioExtension = {
  careerReadinessScore: number;
  universityReadinessScore: number;
  skills: string[];
  professionalBio: string;
  professionalBioEn: string;
  training: Array<{ organizationName: string; volunteerHours: number; status: string }>;
  volunteerHours: number;
  trainingHours: number;
  showResume: boolean;
};

/** Additive public portfolio extension — does not alter achievement/certificate data. */
export const loadPublicCareerPortfolioExtension = async (
  studentId: string
): Promise<PublicCareerPortfolioExtension | null> => {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(studentId)) return null;

  const careerDoc = await StudentCareerProfile.findOne({ studentId }).lean();
  if (!careerDoc) return null;

  const visibility = careerDoc.publicVisibility || { showAchievements: true };
  if (!visibility.showTraining && !visibility.showVolunteer && !visibility.showResume) {
    return null;
  }

  const payload = await buildStudentCareerProfile(studentId, { refreshScores: false });
  if (!payload) return null;

  return {
    careerReadinessScore: payload.scores.careerReadinessScore,
    universityReadinessScore: payload.scores.universityReadinessScore,
    skills: visibility.showResume ? payload.skills.slice(0, 20) : [],
    professionalBio: visibility.showResume ? payload.editable.professionalBio : "",
    professionalBioEn: visibility.showResume ? payload.editable.professionalBioEn : "",
    training: visibility.showTraining
      ? payload.training.map((t) => ({
          organizationName: t.organizationName,
          volunteerHours: t.volunteerHours,
          status: t.status,
        }))
      : [],
    volunteerHours: visibility.showVolunteer ? payload.scores.volunteerHours : 0,
    trainingHours: visibility.showTraining ? payload.scores.trainingHours : 0,
    showResume: visibility.showResume === true,
  };
};
