export type PartnershipProgramSettingsData = {
  defaultAcademicYear: string;
  maxOpportunitiesPerStudent: number;
  allowMultipleApplications: boolean;
  showPortfolioToInstitutions: boolean;
  showExcellenceScoreToInstitutions: boolean;
  allowVideoUpload: boolean;
  maxAttachmentSizeMb: number;
  reviewSlaHours: number;
  institutionDecisionSlaDays: number;
  trainingCompletionSlaDays: number;
  archiveMode: boolean;
  archivedAcademicYear: string;
  backupIntegrationEnabled: boolean;
  lastBackupSnapshotAt: string | null;
};

export const DEFAULT_PARTNERSHIP_PROGRAM_SETTINGS: PartnershipProgramSettingsData = {
  defaultAcademicYear: "",
  maxOpportunitiesPerStudent: 1,
  allowMultipleApplications: false,
  showPortfolioToInstitutions: true,
  showExcellenceScoreToInstitutions: true,
  allowVideoUpload: true,
  maxAttachmentSizeMb: 10,
  reviewSlaHours: 72,
  institutionDecisionSlaDays: 14,
  trainingCompletionSlaDays: 30,
  archiveMode: false,
  archivedAcademicYear: "",
  backupIntegrationEnabled: true,
  lastBackupSnapshotAt: null,
};
