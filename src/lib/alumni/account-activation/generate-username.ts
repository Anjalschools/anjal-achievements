import { randomBytes } from "crypto";
import User from "@/models/User";

const asciiSlug = (name: string): string => {
  const base = String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .replace(/\s+/g, ".")
    .toLowerCase();
  return base.replace(/\.+/g, ".").replace(/^\.|\.$/g, "").slice(0, 28);
};

/**
 * Unique username for auto-provisioned alumni portal accounts.
 */
export const generateUniqueAlumniUsername = async (fullName: string): Promise<string> => {
  const slug = asciiSlug(fullName) || "alumni";
  for (let i = 0; i < 24; i += 1) {
    const suffix = randomBytes(3).toString("hex");
    const candidate = `${slug}.${suffix}`.replace(/\.+/g, ".").replace(/^\.|\.$/g, "");
    const clash = await User.findOne({ username: candidate }).select("_id").lean();
    if (!clash) return candidate;
  }
  return `${slug}.${randomBytes(8).toString("hex")}`;
};

/**
 * Prefer normalized email as portal username; on collision, keep generated username and warn internally.
 */
export const resolveAlumniPortalUsername = async (params: {
  emailNorm: string;
  fullName: string;
}): Promise<string> => {
  const desired = params.emailNorm.trim().toLowerCase();
  if (!desired) return generateUniqueAlumniUsername(params.fullName);
  const clash = await User.findOne({ username: desired }).select("_id").lean();
  if (!clash) return desired;
  console.warn(
    "[alumni onboarding] email unavailable as username (already taken); using generated alumni username"
  );
  return generateUniqueAlumniUsername(params.fullName);
};
