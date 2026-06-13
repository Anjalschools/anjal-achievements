import "server-only";
import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import User from "@/models/User";
import StudentCareerProfile from "@/models/StudentCareerProfile";
import TrainingCompletionRecord from "@/models/TrainingCompletionRecord";
import { buildStudentIntelligence } from "@/lib/student-intelligence-analytics";
import { getStageByGrade } from "@/lib/report-stage-mapping";
import {
  buildStudentSubScores,
  computeStudentSuccessIndex,
  formatSubScoreEvidence,
} from "@/lib/school-intelligence/student-success-index";
import type {
  SchoolDepartment,
  SchoolStage,
  SchoolTrack,
  StudentSuccessGraphNode,
} from "@/lib/school-intelligence/school-intelligence-types";

const toTrack = (section: string | undefined): SchoolTrack => {
  if (section === "arabic") return "arabic";
  if (section === "international") return "international";
  return "unknown";
};

const toDepartment = (isMawhiba: boolean): SchoolDepartment => (isMawhiba ? "mawhiba" : "general");

const inferTrend = (
  growthIndex: number | undefined,
  growthRow?: { growthIndex?: number }
): StudentSuccessGraphNode["recentTrend"] => {
  const g = growthIndex ?? growthRow?.growthIndex ?? 0;
  if (g >= 1.5) return "accelerating";
  if (g >= 0.5) return "improving";
  if (g <= -0.5) return "declining";
  return "stable";
};

const inferMomentum = (medalRatioPct: number, distinctActivityCount: number): StudentSuccessGraphNode["momentum"] => {
  const signal = medalRatioPct * 0.6 + distinctActivityCount * 8;
  if (signal >= 70) return "high";
  if (signal >= 40) return "medium";
  return "low";
};

export const buildStudentSuccessGraph = async (): Promise<StudentSuccessGraphNode[]> => {
  await connectDB();

  const [intel, users, profiles, certCounts, trainingByStudent] = await Promise.all([
    buildStudentIntelligence({}, { lite: false }),
    User.find({ role: "student" })
      .select("_id fullNameAr fullName fullNameEn grade section isMawhibaStudent profilePhoto")
      .limit(5000)
      .lean(),
    StudentCareerProfile.find({})
      .select(
        "studentId achievementsScore skillsScore careerReadinessScore universityReadinessScore trainingHours volunteerHours extractedSkills manualSkills"
      )
      .limit(5000)
      .lean(),
    Achievement.aggregate<{ _id: unknown; count: number }>([
      { $match: { certificateIssued: true, userId: { $exists: true, $ne: null } } },
      { $group: { _id: "$userId", count: { $sum: 1 } } },
    ]),
    TrainingCompletionRecord.aggregate<{ _id: unknown; hours: number; count: number }>([
      { $match: { status: "approved", studentId: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: "$studentId",
          hours: { $sum: { $ifNull: ["$volunteerHours", 0] } },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const intelMap = new Map(intel.byWeightedScore.map((r) => [r.participantId, r]));
  const growthMap = new Map(intel.byFastestGrowth.map((r) => [r.participantId, r]));
  const profileMap = new Map(profiles.map((p) => [String(p.studentId), p]));
  const certMap = new Map(certCounts.map((c) => [String(c._id), c.count]));
  const trainingMap = new Map(trainingByStudent.map((t) => [String(t._id), t]));

  const nodes: StudentSuccessGraphNode[] = [];

  for (const user of users) {
    const studentId = String(user._id);
    const intelRow = intelMap.get(studentId);
    const growthRow = growthMap.get(studentId);
    const profile = profileMap.get(studentId);
    const training = trainingMap.get(studentId);
    const grade = String(user.grade || intelRow?.stageKey || "");
    const stage = getStageByGrade(grade) as SchoolStage;
    const track = toTrack(String(user.section || intelRow?.sectionKey || ""));
    const isMawhiba = Boolean(user.isMawhibaStudent || intelRow?.mawhiba);
    const department = toDepartment(isMawhiba);

    const recordCount = intelRow?.recordCount ?? 0;
    const medalRatioPct = intelRow?.medalRatioPct ?? 0;
    const distinctActivityCount = intelRow?.distinctActivityCount ?? 0;
    const growthIndex = growthRow?.growthIndex ?? intelRow?.growthIndex;
    const yearSpan = growthRow?.yearSpan ?? intelRow?.yearSpan;
    const recentTrend = inferTrend(growthIndex, growthRow);
    const momentum = inferMomentum(medalRatioPct, distinctActivityCount);

    const trainingHours = Number(profile?.trainingHours || training?.hours || 0);
    const volunteerHours = Number(profile?.volunteerHours || 0);
    const approvedTrainingCount = Number(training?.count || 0);

    const subScores = buildStudentSubScores({
      achievementsScore: Number(profile?.achievementsScore || 0),
      skillsScore: Number(profile?.skillsScore || 0),
      careerReadiness: Number(profile?.careerReadinessScore || 0),
      universityReadiness: Number(profile?.universityReadinessScore || 0),
      trainingHours,
      volunteerHours,
      approvedTrainingCount,
      medalRatioPct,
      recordCount,
      distinctActivityCount,
      growthIndex,
      yearSpan,
      recentTrend,
    });

    const successIndex = computeStudentSuccessIndex(subScores);
    const topSkills = [
      ...(profile?.extractedSkills || []).slice(0, 5),
      ...(profile?.manualSkills || []).slice(0, 3),
    ].filter((s, i, arr) => arr.indexOf(s) === i);

    nodes.push({
      studentId,
      fullNameAr: String(user.fullNameAr || intelRow?.nameAr || "").trim(),
      fullNameEn: String(user.fullNameEn || user.fullName || intelRow?.nameEn || "").trim(),
      avatarUrl: String(user.profilePhoto || intelRow?.avatarUrl || ""),
      grade,
      stage,
      track,
      department,
      isMawhiba,
      recordCount,
      medalCount: intelRow?.medalCount ?? 0,
      medalRatioPct,
      distinctActivityCount,
      certificateCount: certMap.get(studentId) ?? 0,
      participationCount: recordCount,
      trainingHours,
      volunteerHours,
      topSkills,
      activityKeys: [],
      growthIndex,
      recentTrend,
      momentum,
      subScores,
      successIndex,
      evidence: formatSubScoreEvidence(subScores, successIndex),
    });
  }

  return nodes.sort((a, b) => b.successIndex - a.successIndex);
};
