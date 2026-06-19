export type IntelligenceSectionStatus = "success" | "no_data" | "unavailable" | "degraded" | "ok";

export type IntelligenceSectionRecovery = {
  retryCount: number;
  recoveredAfterRetry: boolean;
  snapshotFallback: boolean;
  recoveryDurationMs: number;
  outcome: "live" | "retry_success" | "snapshot_fallback" | "query_degraded" | "failed" | "environment_recovered";
  messageAr?: string;
  messageEn?: string;
};

export type IntelligenceSectionError = {
  message: string;
  stack?: string;
  service?: string;
};

export type IntelligenceSectionReport = {
  section: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  status: IntelligenceSectionStatus;
  error?: IntelligenceSectionError;
  service?: string;
  recovery?: IntelligenceSectionRecovery;
  snapshotFallback?: boolean;
};

export type MongoQueryProfile = {
  collection: string;
  operation: string;
  durationMs: number;
  documentsReturned: number;
  slow: boolean;
  pipelineName?: string;
};

export type AggregationFailureReport = {
  pipelineName: string;
  collection: string;
  error: string;
  stageIndex?: number;
};

export type ModelValidationIssue = {
  kind: "missing_model" | "undefined_import" | "circular_dependency";
  name: string;
  message: string;
};

export type EnvironmentHealthCheck = {
  key: "mongodb" | "openai" | "r2" | "redis";
  labelAr: string;
  labelEn: string;
  status: "healthy" | "warning" | "failed";
  detail?: string;
  latencyMs?: number;
};

export type SchoolImprovementFullDiagnostics = {
  totalDurationMs: number;
  generatedAt: string;
  sections: Record<
    string,
    {
      status: IntelligenceSectionStatus;
      startedAt: string;
      completedAt: string;
      durationMs: number;
      message?: string;
      stack?: string;
      service?: string;
      error?: IntelligenceSectionError;
    }
  >;
  sectionReports: IntelligenceSectionReport[];
  warnings: string[];
  slow: boolean;
  slowSections: string[];
  healthySections: string[];
  unavailableSections: string[];
  mongoQueries: MongoQueryProfile[];
  aggregationFailures: AggregationFailureReport[];
  modelIssues: ModelValidationIssue[];
  environment: EnvironmentHealthCheck[];
  healthScore?: IntelligenceHealthScoreResult;
  monitoring?: IntelligenceHealthMonitoringPayload;
  resilienceScore?: IntelligenceResilienceScoreResult;
  recommendations?: IntelligenceFailureRecommendation[];
};

export type IntelligenceFailureRecommendation = {
  id: string;
  priority: "high" | "medium" | "low";
  titleAr: string;
  titleEn: string;
  messageAr: string;
  messageEn: string;
  target: string;
};

export type IntelligenceResilienceScoreResult = {
  score: number;
  labelAr: string;
  labelEn: string;
};

export type IntelligenceRecoveryStatsSummary = {
  total: number;
  recovered: number;
  autoHealed: number;
  failed: number;
  retrySuccess: number;
  snapshotFallback: number;
  queryDegraded: number;
  environmentRecovered: number;
  recoveryRatePct: number;
  mostStableServices: Array<{ service: string; success: number; failure: number; stability: number }>;
  mostUnstableServices: Array<{ service: string; success: number; failure: number; stability: number }>;
};

export type IntelligenceHealthScoreResult = {
  score: number;
  band: "excellent" | "very_good" | "needs_attention" | "critical";
  labelAr: string;
  labelEn: string;
  deductions: Array<{ reason: string; points: number }>;
};

export type IntelligenceHealthTrendPoint = {
  timestamp: string;
  value: number;
};

export type IntelligenceHealthAlertSummary = {
  id: string;
  alertKey: string;
  level: "info" | "warning" | "critical";
  kind: string;
  titleAr: string;
  titleEn: string;
  messageAr: string;
  messageEn: string;
  service?: string;
  section?: string;
  status: "active" | "resolved";
  firstSeenAt: string;
  lastSeenAt: string;
  occurrenceCount: number;
};

export type IntelligenceRecoverySummary = {
  id: string;
  service?: string;
  section?: string;
  resolvedAt: string;
  downtimeMs: number;
  messageAr: string;
  messageEn: string;
};

export type IntelligenceRootCauseLeaderboardRow = {
  service: string;
  occurrences: number;
  lastSeenAt: string;
  averageImpact: number;
};

export type IntelligenceHealthMonitoringPayload = {
  healthScore: IntelligenceHealthScoreResult;
  latestSnapshot: {
    timestamp: string;
    healthScore: number;
    healthySections: string[];
    unavailableSections: string[];
    slowSections: string[];
    environmentStatus: Partial<Record<EnvironmentHealthCheck["key"], EnvironmentHealthCheck["status"]>>;
  };
  alerts: IntelligenceHealthAlertSummary[];
  recoveries: IntelligenceRecoverySummary[];
  trends: {
    last24Hours: {
      healthScore: IntelligenceHealthTrendPoint[];
      slowQueries: IntelligenceHealthTrendPoint[];
      unavailableSections: IntelligenceHealthTrendPoint[];
    };
    last7Days: {
      healthScore: IntelligenceHealthTrendPoint[];
      slowQueries: IntelligenceHealthTrendPoint[];
      unavailableSections: IntelligenceHealthTrendPoint[];
    };
    last30Days: {
      healthScore: IntelligenceHealthTrendPoint[];
      slowQueries: IntelligenceHealthTrendPoint[];
      unavailableSections: IntelligenceHealthTrendPoint[];
    };
  };
  failureLeaderboard: IntelligenceRootCauseLeaderboardRow[];
  summary: {
    criticalCount: number;
    warningCount: number;
    recoveryCount: number;
    recoveryRatePct: number;
    autoHealedIncidents: number;
    recoveredServices: number;
  };
  resilienceScore?: IntelligenceResilienceScoreResult;
  recommendations?: IntelligenceFailureRecommendation[];
  mostStableServices?: Array<{ service: string; success: number; failure: number; stability: number }>;
  mostUnstableServices?: Array<{ service: string; success: number; failure: number; stability: number }>;
};
