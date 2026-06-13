export type CertificationSeverity = "critical" | "high" | "medium" | "low" | "info";

export type CertificationIssue = {
  code: string;
  severity: CertificationSeverity;
  domain: string;
  entityType?: string;
  entityId?: string;
  messageAr: string;
  messageEn: string;
  evidence?: string;
};

export type SubsystemHealthStatus = {
  key: string;
  labelAr: string;
  labelEn: string;
  ok: boolean;
  latencyMs?: number;
  detailAr: string;
  detailEn: string;
  issues: CertificationIssue[];
};

export type ExportTestResult = {
  key: string;
  labelAr: string;
  labelEn: string;
  format: "csv" | "xlsx" | "html" | "pdf";
  passed: boolean;
  durationMs: number;
  byteSize: number;
  error?: string;
};

export type BackupValidationResult = {
  ok: boolean;
  snapshotMarkerAt: string | null;
  collectionCounts: Record<string, number>;
  restoreSimulationOk: boolean;
  issues: CertificationIssue[];
  noteAr: string;
  noteEn: string;
};

export type PerformanceMetric = {
  key: string;
  labelAr: string;
  labelEn: string;
  durationMs: number;
  resultCount?: number;
  payloadBytes?: number;
  withinLimit: boolean;
  limitMs: number;
};

export type AuditCoverageItem = {
  actionType: string;
  labelAr: string;
  labelEn: string;
  registered: boolean;
  recentEventCount: number;
  covered: boolean;
};

export type SecurityCheck = {
  key: string;
  labelAr: string;
  labelEn: string;
  passed: boolean;
  detailAr: string;
  detailEn: string;
};

export type ObservabilitySnapshot = {
  slowRouteCount: number;
  integrityViolationCount: number;
  recentAuditFailures: number;
  warnings: CertificationIssue[];
  errors: CertificationIssue[];
};

export type ReadinessBreakdownRow = {
  area: string;
  labelAr: string;
  labelEn: string;
  score: number;
  maxScore: number;
  weight: number;
};

export type PlatformCertificationPayload = {
  generatedAt: string;
  readinessScore: number;
  readinessGrade: "excellent" | "good" | "fair" | "poor" | "critical";
  subsystemHealth: SubsystemHealthStatus[];
  dataQuality: {
    issueCount: number;
    issues: CertificationIssue[];
    summary: Record<string, number>;
  };
  crossSystemIntegrity: {
    issueCount: number;
    issues: CertificationIssue[];
  };
  exportCertification: {
    tests: ExportTestResult[];
    passed: number;
    failed: number;
  };
  backupValidation: BackupValidationResult;
  performance: {
    metrics: PerformanceMetric[];
    memoryMb: { heapUsed: number; heapTotal: number; rss: number };
    bsonLimitNote: string;
  };
  auditCoverage: {
    items: AuditCoverageItem[];
    coveragePct: number;
    gaps: string[];
  };
  securityReview: {
    checks: SecurityCheck[];
    passed: number;
    failed: number;
  };
  observability: ObservabilitySnapshot;
  readinessBreakdown: ReadinessBreakdownRow[];
  governance: {
    readOnly: true;
    explainable: true;
    dataSources: string[];
  };
};
