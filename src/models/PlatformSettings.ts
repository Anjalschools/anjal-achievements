import mongoose, { Schema, Document, Model } from "mongoose";

/** Single-document platform configuration (singleton key). */
export interface IPlatformSettings extends Document {
  singletonKey: string;
  schoolYearPolicy?: {
    autoArchivePreviousWhenActivating?: boolean;
  };
  branding?: {
    schoolNameAr?: string;
    schoolNameEn?: string;
    educationalAuthorityAr?: string;
    educationalAuthorityEn?: string;
    cityAr?: string;
    cityEn?: string;
    websiteUrl?: string;
    contactEmailPrimary?: string;
    contactEmailSecondary?: string;
    contactPhonePrimary?: string;
    contactPhoneSecondary?: string;
    contactAddressAr?: string;
    contactAddressEn?: string;
    contactInfoTitleAr?: string;
    contactInfoTitleEn?: string;
    contactPageIntroAr?: string;
    contactPageIntroEn?: string;
    mapEmbedUrl?: string;
    mapTitleAr?: string;
    mapTitleEn?: string;
    mapLocationLabelAr?: string;
    mapLocationLabelEn?: string;
    latitude?: number;
    longitude?: number;
    socialFacebook?: string;
    socialX?: string;
    socialYoutube?: string;
    socialInstagram?: string;
    mainLogo?: string;
    secondaryLogo?: string;
    reportHeaderImage?: string;
    reportFooterImage?: string;
    certificateSignatureName?: string;
    certificateSignatureTitle?: string;
    certificateSignatureImage?: string;
    officialStampImage?: string;
  };
  ai?: {
    aiEnabled?: boolean;
    aiFieldSuggestionEnabled?: boolean;
    aiDuplicateDetectionEnabled?: boolean;
    aiAttachmentReviewEnabled?: boolean;
    aiMediaGenerationEnabled?: boolean;
    aiInsightsEnabled?: boolean;
    minConfidenceForSuggestions?: number;
    minConfidenceForDuplicateFlag?: number;
    minConfidenceForMediaRecommendation?: number;
  };
  certificate?: {
    certificateTitleAr?: string;
    certificateTitleEn?: string;
    certificatePrefix?: string;
    verificationEnabled?: boolean;
    qrEnabled?: boolean;
    showStudentGrade?: boolean;
    showAchievementLevel?: boolean;
    showAchievementDate?: boolean;
    showAchievementResult?: boolean;
    verificationSuccessMessageAr?: string;
    verificationFailureMessageAr?: string;
    verificationSuccessMessageEn?: string;
    verificationFailureMessageEn?: string;
  };
  workflow?: {
    adminCanDirectApprove?: boolean;
    requireAiReviewBeforeManualReview?: boolean;
    allowEditApprovedAchievementByAdmin?: boolean;
    allowDeleteApprovedAchievementByAdmin?: boolean;
    autoFeatureTopAchievements?: boolean;
    showApprovedDirectlyInHallOfFame?: boolean;
    requireMediaApprovalBeforePublishing?: boolean;
  };
  scoring?: Record<string, unknown>;
  /** Dynamic role -> permissions matrix overrides */
  rolePermissions?: Record<string, string[]>;
  updatedAt: Date;
}

const PlatformSettingsSchema = new Schema(
  {
    singletonKey: { type: String, required: true, unique: true, default: "default" },
    schoolYearPolicy: { type: Schema.Types.Mixed, default: {} },
    branding: { type: Schema.Types.Mixed, default: {} },
    ai: { type: Schema.Types.Mixed, default: {} },
    certificate: { type: Schema.Types.Mixed, default: {} },
    workflow: { type: Schema.Types.Mixed, default: {} },
    scoring: { type: Schema.Types.Mixed, default: {} },
    rolePermissions: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

const PlatformSettings: Model<IPlatformSettings> =
  mongoose.models.PlatformSettings ||
  mongoose.model<IPlatformSettings>("PlatformSettings", PlatformSettingsSchema);

export default PlatformSettings;
