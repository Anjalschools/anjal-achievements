import { randomBytes } from "crypto";
import { newPasswordMeetsPolicy } from "@/lib/user-account-preferences";

const lastFourDigitsFromPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, "");
  if (!digits.length) return "0000";
  const tail = digits.slice(-4);
  return tail.length >= 4 ? tail : tail.padStart(4, "0");
};

/**
 * Initial alumni portal password: Anjal@ + last 4 digits of mobile (falls back to random if policy fails).
 */
export const generateAlumniInitialPassword = (phone?: string | null): string => {
  const suffix = lastFourDigitsFromPhone(String(phone ?? "").trim());
  const candidate = `Anjal@${suffix}`;
  if (newPasswordMeetsPolicy(candidate)) return candidate;
  return generateTempPassword();
};

/**
 * Cryptographically random temporary password meeting platform policy (never log or return in APIs).
 */
export const generateTempPassword = (): string => {
  for (let i = 0; i < 40; i += 1) {
    const core = randomBytes(10).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, 12);
    const candidate = `${core}Aa1`;
    if (newPasswordMeetsPolicy(candidate)) return candidate;
  }
  return `Aa1${randomBytes(12).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, 16)}`;
};
