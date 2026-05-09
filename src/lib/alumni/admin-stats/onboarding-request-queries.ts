import AlumniOnboardingRequest from "@/models/AlumniOnboardingRequest";
import User from "@/models/User";
import { alumniCommunityActiveUserClause } from "@/lib/alumni/alumni-community-active";

export const escapeRegExpForOnboarding = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const buildOnboardingScopeFilter = (params: {
  q: string;
  activationParam: string | null;
  isValidActivation: (value: unknown) => value is string;
}): Record<string, unknown> => {
  const filter: Record<string, unknown> = {};
  if (params.isValidActivation(params.activationParam)) {
    filter.alumniActivationStatus = params.activationParam;
  }
  if (params.q) {
    const escaped = escapeRegExpForOnboarding(params.q);
    filter.$or = [
      { fullName: { $regex: escaped, $options: "i" } },
      { email: { $regex: escaped, $options: "i" } },
      { universityName: { $regex: escaped, $options: "i" } },
      { currentCompany: { $regex: escaped, $options: "i" } },
    ];
  }
  return filter;
};

export type OnboardingAdminStatsPayload = {
  total: number;
  breakdown: { pending: number; approved: number; rejected: number };
  activeAlumniUsers: number;
  duplicateRequestEmails: string[];
};

export const computeOnboardingAdminStats = async (
  fullFilter: Record<string, unknown>,
  scopeFilter: Record<string, unknown>
): Promise<OnboardingAdminStatsPayload> => {
  const [total, pending, approved, rejected, activeAlumniUsers, dupAgg] = await Promise.all([
    AlumniOnboardingRequest.countDocuments(fullFilter),
    AlumniOnboardingRequest.countDocuments({ ...scopeFilter, status: "pending" }),
    AlumniOnboardingRequest.countDocuments({ ...scopeFilter, status: "approved" }),
    AlumniOnboardingRequest.countDocuments({ ...scopeFilter, status: "rejected" }),
    User.countDocuments({
      accountType: "alumni",
      ...alumniCommunityActiveUserClause(),
    }),
    AlumniOnboardingRequest.aggregate<{ _id: string }>([
      { $group: { _id: "$email", c: { $sum: 1 } } },
      { $match: { c: { $gt: 1 } } },
    ]),
  ]);

  return {
    total,
    breakdown: { pending, approved, rejected },
    activeAlumniUsers,
    duplicateRequestEmails: dupAgg.map((d) => String(d._id || "").toLowerCase()).filter(Boolean),
  };
};
