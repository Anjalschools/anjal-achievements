import connectDB from "@/lib/mongodb";
import PlatformSettings, { type IPlatformSettings } from "@/models/PlatformSettings";

const SINGLETON = "default";

const defaultAi = (): NonNullable<IPlatformSettings["ai"]> => ({
  aiEnabled: true,
  aiFieldSuggestionEnabled: true,
  aiDuplicateDetectionEnabled: true,
  aiAttachmentReviewEnabled: true,
  aiMediaGenerationEnabled: true,
  aiInsightsEnabled: true,
  minConfidenceForSuggestions: 0.55,
  minConfidenceForDuplicateFlag: 0.6,
  minConfidenceForMediaRecommendation: 0.5,
});

const defaultWorkflow = (): NonNullable<IPlatformSettings["workflow"]> => ({
  adminCanDirectApprove: true,
  requireAiReviewBeforeManualReview: false,
  allowEditApprovedAchievementByAdmin: true,
  allowDeleteApprovedAchievementByAdmin: false,
  autoFeatureTopAchievements: false,
  showApprovedDirectlyInHallOfFame: true,
  requireMediaApprovalBeforePublishing: false,
});

const defaultCertificate = (): NonNullable<IPlatformSettings["certificate"]> => ({
  verificationEnabled: true,
  qrEnabled: true,
  showStudentGrade: true,
  showAchievementLevel: true,
  showAchievementDate: true,
  showAchievementResult: true,
});

export const getPlatformSettings = async (): Promise<{
  schoolYearPolicy: NonNullable<IPlatformSettings["schoolYearPolicy"]>;
  branding: NonNullable<IPlatformSettings["branding"]>;
  ai: NonNullable<IPlatformSettings["ai"]>;
  certificate: NonNullable<IPlatformSettings["certificate"]>;
  workflow: NonNullable<IPlatformSettings["workflow"]>;
  updatedAt: Date | null;
}> => {
  await connectDB();
  const doc = await PlatformSettings.findOne({ singletonKey: SINGLETON }).lean();
  const d = doc as unknown as Record<string, unknown> | null;
  return {
    schoolYearPolicy: {
      autoArchivePreviousWhenActivating: false,
      ...(d?.schoolYearPolicy as object),
    },
    branding: { ...(d?.branding as object) },
    ai: { ...defaultAi(), ...(d?.ai as object) },
    certificate: { ...defaultCertificate(), ...(d?.certificate as object) },
    workflow: { ...defaultWorkflow(), ...(d?.workflow as object) },
    updatedAt: d?.updatedAt instanceof Date ? d.updatedAt : null,
  };
};

export const mergePlatformSettingsPatch = async (
  patch: Partial<{
    schoolYearPolicy: Record<string, unknown>;
    branding: Record<string, unknown>;
    ai: Record<string, unknown>;
    certificate: Record<string, unknown>;
    workflow: Record<string, unknown>;
  }>
): Promise<void> => {
  await connectDB();
  const cur = await PlatformSettings.findOne({ singletonKey: SINGLETON });
  if (!cur) {
    await PlatformSettings.create({
      singletonKey: SINGLETON,
      schoolYearPolicy: { ...patch.schoolYearPolicy },
      branding: { ...patch.branding },
      ai: { ...defaultAi(), ...patch.ai },
      certificate: { ...defaultCertificate(), ...patch.certificate },
      workflow: { ...defaultWorkflow(), ...patch.workflow },
    });
    return;
  }
  if (patch.schoolYearPolicy) {
    cur.set("schoolYearPolicy", { ...(cur.get("schoolYearPolicy") as object), ...patch.schoolYearPolicy });
  }
  if (patch.branding) {
    cur.set("branding", { ...(cur.get("branding") as object), ...patch.branding });
  }
  if (patch.ai) {
    cur.set("ai", { ...defaultAi(), ...(cur.get("ai") as object), ...patch.ai });
  }
  if (patch.certificate) {
    cur.set("certificate", { ...defaultCertificate(), ...(cur.get("certificate") as object), ...patch.certificate });
  }
  if (patch.workflow) {
    cur.set("workflow", { ...defaultWorkflow(), ...(cur.get("workflow") as object), ...patch.workflow });
  }
  await cur.save();
};
