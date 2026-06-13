import connectDB from "@/lib/mongodb";
import StudentCareerProfile from "@/models/StudentCareerProfile";

import { buildPartnershipAnalyticsSummary } from "@/lib/partnerships/institution-analytics-service";

const avg = (values: number[]) =>
  values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : 0;

export const buildCareerAnalyticsDashboard = async () => {
  await connectDB();
  const profiles = await StudentCareerProfile.find({})
    .select(
      "careerReadinessScore universityReadinessScore volunteerHours trainingHours achievementsScore leadershipScore skillsScore extractedSkills manualSkills targetMajors"
    )
    .limit(5000)
    .lean();

  const skillCounts = new Map<string, number>();
  const majorCounts = new Map<string, number>();

  for (const row of profiles) {
    for (const skill of [...(row.extractedSkills || []), ...(row.manualSkills || [])]) {
      const key = String(skill).trim();
      if (key) skillCounts.set(key, (skillCounts.get(key) || 0) + 1);
    }
    for (const major of row.targetMajors || []) {
      const key = String(major).trim();
      if (key) majorCounts.set(key, (majorCounts.get(key) || 0) + 1);
    }
  }

  const topSkills = [...skillCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, count]) => ({ name, count }));

  const topPathways = [...majorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  const careerScores = profiles.map((r) => Number(r.careerReadinessScore || 0));
  const universityScores = profiles.map((r) => Number(r.universityReadinessScore || 0));

  const readinessBands = (scores: number[]) => ({
    high: scores.filter((s) => s >= 75).length,
    medium: scores.filter((s) => s >= 50 && s < 75).length,
    developing: scores.filter((s) => s < 50).length,
  });

  const careerReadinessBands = readinessBands(careerScores);
  const universityReadinessBands = readinessBands(universityScores);

  const partnershipAnalytics = await buildPartnershipAnalyticsSummary();

  return {
    totalProfiles: profiles.length,
    averages: {
      careerReadiness: avg(careerScores),
      universityReadiness: avg(universityScores),
      volunteerHours: avg(profiles.map((r) => Number(r.volunteerHours || 0))),
      trainingHours: avg(profiles.map((r) => Number(r.trainingHours || 0))),
      achievementsScore: avg(profiles.map((r) => Number(r.achievementsScore || 0))),
      leadershipScore: avg(profiles.map((r) => Number(r.leadershipScore || 0))),
      skillsScore: avg(profiles.map((r) => Number(r.skillsScore || 0))),
    },
    careerReadinessBands,
    universityReadinessBands,
    topSkills,
    topPathways,
    partnershipAnalytics,
    measuredAt: new Date().toISOString(),
  };
};
