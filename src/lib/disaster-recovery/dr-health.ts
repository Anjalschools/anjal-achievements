import "server-only";
import connectDB from "@/lib/mongodb";
import BackupRecord from "@/models/BackupRecord";

export type BackupHealthDashboard = {
  databaseBackupStatus: "healthy" | "warning" | "unknown";
  objectBackupStatus: "healthy" | "warning" | "unknown";
  lastSuccessfulBackupAt: string | null;
  lastValidationAt: string | null;
  filesProtected: number;
  totalStorageSizeBytes: number;
  recoveryReadinessScore: number;
  recentBackups: Array<{
    id: string;
    fileName: string;
    backupKind?: string;
    status: string;
    sizeBytes: number;
    objectCount?: number;
    recoveryReadinessScore?: number;
    validationStatus?: string;
    createdAt: string | null;
  }>;
};

export const getBackupHealthDashboard = async (): Promise<BackupHealthDashboard> => {
  await connectDB();
  const rows = await BackupRecord.find({ status: "completed" })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  const last = rows[0];
  const drRows = rows.filter((row) => row.includesObjectStorage || row.backupKind === "disaster_recovery");
  const lastDr = drRows[0];

  const filesProtected = drRows.reduce((sum, row) => sum + (row.objectCount || 0), 0);
  const totalStorageSizeBytes = rows.reduce((sum, row) => sum + (row.sizeBytes || 0), 0);

  return {
    databaseBackupStatus: last ? "healthy" : "unknown",
    objectBackupStatus: lastDr ? "healthy" : rows.length ? "warning" : "unknown",
    lastSuccessfulBackupAt: last?.createdAt ? new Date(last.createdAt).toISOString() : null,
    lastValidationAt: rows.find((row) => row.lastValidatedAt)?.lastValidatedAt
      ? new Date(rows.find((row) => row.lastValidatedAt)!.lastValidatedAt!).toISOString()
      : null,
    filesProtected,
    totalStorageSizeBytes,
    recoveryReadinessScore: lastDr?.recoveryReadinessScore || last?.recoveryReadinessScore || 0,
    recentBackups: rows.map((row) => ({
      id: String(row._id),
      fileName: row.fileName,
      backupKind: row.backupKind,
      status: row.status,
      sizeBytes: row.sizeBytes || 0,
      objectCount: row.objectCount,
      recoveryReadinessScore: row.recoveryReadinessScore,
      validationStatus: row.validationStatus,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    })),
  };
};
