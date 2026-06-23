export const BACKUP_MANIFEST_VERSION = "11.2";
export const LEGACY_BACKUP_MANIFEST_VERSION = "11.1";

export const BACKUP_PLATFORM_VERSION = process.env.npm_package_version || "1.0.0";

export const BACKUP_EXPORT_BATCH_SIZE = 500;

export const BACKUP_RESTORE_BATCH_SIZE = 250;

export type BackupModuleId =
  | "full"
  | "users"
  | "achievements"
  | "school-years"
  | "training"
  | "settings"
  | "alumni"
  | "audit-logs"
  | "notifications";

export type BackupStorageProviderId = "local" | "r2";

export type RestoreMode = "replace" | "merge" | "selective";

export type BackupModuleDefinition = {
  id: BackupModuleId;
  labelAr: string;
  labelEn: string;
  collectionKeys: string[];
};

/** Logical collection keys map to MongoDB collection names (verified against Mongoose models). */
export const BACKUP_COLLECTION_REGISTRY: Record<string, string> = {
  users: "users",
  achievements: "achievements",
  schoolYears: "schoolyears",
  academicYears: "academicyears",
  academicSnapshots: "academicsnapshots",
  studentTrainingApplications: "studenttrainingapplications",
  trainingOpportunities: "trainingopportunities",
  trainingCompletionRecords: "trainingcompletionrecords",
  trainingAttachments: "trainingattachments",
  trainingAssessments: "trainingassessments",
  trainingInterviews: "traininginterviews",
  trainingFinalStudentEvaluations: "trainingfinalstudentevaluations",
  trainingFinalInstitutionEvaluations: "trainingfinalinstitutionevaluations",
  trainingOutcomeRecords: "trainingoutcomerecords",
  volunteerRecords: "volunteerrecords",
  partnerOrganizations: "partnerorganizations",
  partnerAccessTokens: "partneraccesstokens",
  partnershipThreads: "partnershipthreads",
  partnershipMessages: "partnershipmessages",
  partnershipMessageAudits: "partnershipmessageaudits",
  partnershipProgramSettings: "partnershipprogramsettings",
  institutionReviews: "institutionreviews",
  institutionPrivateNotes: "institutionprivatenotes",
  institutionCandidateTags: "institutioncandidatetags",
  applicationRequirements: "applicationrequirements",
  siteSettings: "sitesettings",
  platformSettings: "platformsettings",
  auditLogs: "auditlogs",
  notifications: "notifications",
  alumniAnnouncements: "alumniannouncements",
  alumniStories: "alumnistories",
  alumniOpportunities: "alumniopportunities",
  alumniCampaigns: "alumnicampaigns",
  alumniCohorts: "alumnicohorts",
  alumniVerificationRequests: "alumniverificationrequests",
  alumniOnboardingRequests: "alumnionboardingrequests",
  backupRecords: "backuprecords",
};

const USERS_KEYS = ["users"];
const ACHIEVEMENTS_KEYS = ["achievements"];
const SCHOOL_YEARS_KEYS = ["schoolYears", "academicYears", "academicSnapshots"];
const TRAINING_KEYS = [
  "studentTrainingApplications",
  "trainingOpportunities",
  "trainingCompletionRecords",
  "trainingAttachments",
  "trainingAssessments",
  "trainingInterviews",
  "trainingFinalStudentEvaluations",
  "trainingFinalInstitutionEvaluations",
  "trainingOutcomeRecords",
  "volunteerRecords",
  "partnerOrganizations",
  "partnerAccessTokens",
  "partnershipThreads",
  "partnershipMessages",
  "partnershipMessageAudits",
  "partnershipProgramSettings",
  "institutionReviews",
  "institutionPrivateNotes",
  "institutionCandidateTags",
  "applicationRequirements",
];
const SETTINGS_KEYS = ["siteSettings", "platformSettings", "partnershipProgramSettings"];
const ALUMNI_KEYS = [
  "alumniAnnouncements",
  "alumniStories",
  "alumniOpportunities",
  "alumniCampaigns",
  "alumniCohorts",
  "alumniVerificationRequests",
  "alumniOnboardingRequests",
];
const AUDIT_KEYS = ["auditLogs"];
const NOTIFICATIONS_KEYS = ["notifications"];

const FULL_KEYS = [
  ...USERS_KEYS,
  ...ACHIEVEMENTS_KEYS,
  ...SCHOOL_YEARS_KEYS,
  ...TRAINING_KEYS,
  ...SETTINGS_KEYS,
  ...ALUMNI_KEYS,
  ...AUDIT_KEYS,
  ...NOTIFICATIONS_KEYS,
];

export const BACKUP_MODULES: BackupModuleDefinition[] = [
  {
    id: "full",
    labelAr: "نسخة احتياطية كاملة",
    labelEn: "Full database backup",
    collectionKeys: FULL_KEYS,
  },
  {
    id: "users",
    labelAr: "المستخدمون",
    labelEn: "Users",
    collectionKeys: USERS_KEYS,
  },
  {
    id: "achievements",
    labelAr: "الإنجازات",
    labelEn: "Achievements",
    collectionKeys: ACHIEVEMENTS_KEYS,
  },
  {
    id: "school-years",
    labelAr: "الأعوام الدراسية",
    labelEn: "School years",
    collectionKeys: SCHOOL_YEARS_KEYS,
  },
  {
    id: "training",
    labelAr: "التدريب والشراكات",
    labelEn: "Training & partnerships",
    collectionKeys: TRAINING_KEYS,
  },
  {
    id: "settings",
    labelAr: "الإعدادات",
    labelEn: "Settings",
    collectionKeys: SETTINGS_KEYS,
  },
  {
    id: "alumni",
    labelAr: "الخريجون",
    labelEn: "Alumni",
    collectionKeys: ALUMNI_KEYS,
  },
  {
    id: "audit-logs",
    labelAr: "سجلات التدقيق",
    labelEn: "Audit logs",
    collectionKeys: AUDIT_KEYS,
  },
  {
    id: "notifications",
    labelAr: "الإشعارات",
    labelEn: "Notifications",
    collectionKeys: NOTIFICATIONS_KEYS,
  },
];

export const getBackupModule = (moduleId: BackupModuleId): BackupModuleDefinition => {
  const mod = BACKUP_MODULES.find((row) => row.id === moduleId);
  if (!mod) throw new Error(`UNKNOWN_BACKUP_MODULE:${moduleId}`);
  return mod;
};

export const resolveCollectionFileName = (collectionKey: string): string => {
  const mongoName = BACKUP_COLLECTION_REGISTRY[collectionKey];
  if (!mongoName) throw new Error(`UNKNOWN_COLLECTION_KEY:${collectionKey}`);
  return `${mongoName}.json`;
};

export const resolveMongoCollectionName = (collectionKey: string): string => {
  const mongoName = BACKUP_COLLECTION_REGISTRY[collectionKey];
  if (!mongoName) throw new Error(`UNKNOWN_COLLECTION_KEY:${collectionKey}`);
  return mongoName;
};

export const isRestoreCollectionKeyAllowed = (
  collectionKey: string,
  allowedKeys: string[]
): boolean => allowedKeys.includes(collectionKey);
