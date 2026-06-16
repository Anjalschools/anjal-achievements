import "server-only";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import { buildStudentCareerProfile } from "@/lib/career/student-career-profile-service";
import { FINAL_EVALUATION_CAREER_EVENT } from "@/lib/partnerships/training-final-evaluation-constants";
import TrainingFinalInstitutionEvaluation from "@/models/TrainingFinalInstitutionEvaluation";
import TrainingFinalStudentEvaluation from "@/models/TrainingFinalStudentEvaluation";

/** Extension hook — does not modify Career Engine internals. */
export const emitTrainingFinalEvaluationCareerEvent = async (
  studentId: string,
  applicationId: string
): Promise<void> => {
  if (!mongoose.Types.ObjectId.isValid(studentId)) return;

  await connectDB();
  const [studentEval, institutionEval] = await Promise.all([
    TrainingFinalStudentEvaluation.findOne({ applicationId }).lean(),
    TrainingFinalInstitutionEvaluation.findOne({ applicationId }).lean(),
  ]);

  if (process.env.AI_DEBUG === "1") {
    console.info("[career-event]", FINAL_EVALUATION_CAREER_EVENT, {
      studentId,
      applicationId,
      studentSatisfaction: studentEval?.overallSatisfactionScore,
      institutionPassed: institutionEval?.passedTraining,
      recommendEmployment: institutionEval?.recommendEmployment,
    });
  }

  await buildStudentCareerProfile(studentId);
};
