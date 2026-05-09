import { randomBytes } from "crypto";
import { newPasswordMeetsPolicy } from "@/lib/user-account-preferences";

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
