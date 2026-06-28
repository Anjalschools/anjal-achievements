const STAGE_STARTED_LOG: Record<string, string> = {
  database: "DATABASE_STAGE_STARTED",
  "storage-inventory": "STORAGE_DISCOVERY_STARTED",
  "asset-download": "DOWNLOAD_STAGE_STARTED",
  "package-build": "PACKAGE_BUILD_STARTED",
  verification: "VERIFY_STARTED",
  upload: "UPLOAD_STARTED",
};

const STAGE_COMPLETED_LOG: Record<string, string> = {
  database: "DATABASE_STAGE_COMPLETED",
  "storage-inventory": "STORAGE_DISCOVERY_COMPLETED",
  "asset-download": "DOWNLOAD_COMPLETED",
  "package-build": "PACKAGE_BUILD_COMPLETED",
  verification: "VERIFY_COMPLETED",
  upload: "UPLOAD_COMPLETED",
};

export const logDrV2 = (
  event: string,
  meta: Record<string, unknown> = {}
): void => {
  console.info(`[DR.V2] ${event}`, {
    timestamp: new Date().toISOString(),
    ...meta,
  });
};

export const logDrV2StageStarted = (
  stageId: string,
  meta: Record<string, unknown> = {}
): void => {
  const event = STAGE_STARTED_LOG[stageId] ?? "STAGE_STARTED";
  logDrV2(event, { stageId, ...meta });
};

export const logDrV2StageCompleted = (
  stageId: string,
  meta: Record<string, unknown> = {}
): void => {
  const event = STAGE_COMPLETED_LOG[stageId] ?? "STAGE_COMPLETED";
  logDrV2(event, { stageId, ...meta });
};
