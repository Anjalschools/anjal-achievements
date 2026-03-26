export type NotificationPreferences = {
  news: boolean;
  review: boolean;
  system: boolean;
  email: boolean;
};

export type PrivacyPreferences = {
  showNameInSystem: boolean;
  showEmailToSupervisors: boolean;
  showProfileInAdminPanel: boolean;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  news: true,
  review: true,
  system: true,
  email: true,
};

export const DEFAULT_PRIVACY_PREFS: PrivacyPreferences = {
  showNameInSystem: true,
  showEmailToSupervisors: true,
  showProfileInAdminPanel: true,
};

export const mergeNotificationPrefs = (
  raw?: Partial<NotificationPreferences> | null
): NotificationPreferences => ({
  ...DEFAULT_NOTIFICATION_PREFS,
  ...raw,
});

export const mergePrivacyPrefs = (
  raw?: Partial<PrivacyPreferences> | null
): PrivacyPreferences => ({
  ...DEFAULT_PRIVACY_PREFS,
  ...raw,
});

/** Saudi-style mobile: 10 digits starting with 05 */
export const isValidSaMobile = (v: string): boolean =>
  /^05\d{8}$/.test(v.replace(/\D/g, ""));

export const isValidEmail = (v: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export type PasswordStrengthResult = {
  score: number;
  max: number;
  passesMinLength: boolean;
  passesUpper: boolean;
  passesNumber: boolean;
};

export const evaluatePasswordStrength = (pw: string): PasswordStrengthResult => {
  const passesMinLength = pw.length >= 8;
  const passesUpper = /[A-Z]/.test(pw);
  const passesNumber = /[0-9]/.test(pw);
  const score = [passesMinLength, passesUpper, passesNumber].filter(Boolean).length;
  return { score, max: 3, passesMinLength, passesUpper, passesNumber };
};

export const newPasswordMeetsPolicy = (pw: string): boolean => {
  const e = evaluatePasswordStrength(pw);
  return e.passesMinLength && e.passesUpper && e.passesNumber;
};
