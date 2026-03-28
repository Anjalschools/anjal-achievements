/** Set NOTIFICATION_DEBUG=1 for concise server logs (no PII beyond ids/counts). */
export const isNotificationDebug = (): boolean => process.env.NOTIFICATION_DEBUG === "1";

export const notificationDebugLog = (event: string, data: Record<string, unknown>): void => {
  if (!isNotificationDebug()) return;
  console.info(`[notifications:${event}]`, { ...data, at: new Date().toISOString() });
};
