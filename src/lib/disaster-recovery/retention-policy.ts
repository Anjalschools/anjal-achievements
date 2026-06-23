export type RetentionTier = "daily" | "weekly" | "monthly";

export const RETENTION_WINDOWS_DAYS: Record<RetentionTier, number> = {
  daily: 30,
  weekly: 12 * 7,
  monthly: 12 * 30,
};

export const resolveRetentionExpiry = (tier: RetentionTier, from = new Date()): Date => {
  const days = RETENTION_WINDOWS_DAYS[tier];
  return new Date(from.getTime() - days * 24 * 60 * 60 * 1000);
};

export const isBackupExpired = (input: {
  createdAt: Date | string;
  retentionTier?: RetentionTier | null;
}): boolean => {
  const tier = input.retentionTier || "daily";
  const createdAt = new Date(input.createdAt);
  const cutoff = resolveRetentionExpiry(tier);
  return createdAt < cutoff;
};
