import { v2 as cloudinarySdk } from "cloudinary";

const REQUIRED_ENV = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
] as const;

/** True when all Cloudinary env vars are present (non-empty after trim). */
export const isCloudinaryConfigured = (): boolean =>
  REQUIRED_ENV.every((key) => Boolean(process.env[key]?.trim()));

/**
 * Throws with a clear message if Cloudinary env is incomplete.
 * Use before any upload in API routes.
 */
export const assertCloudinaryEnv = (): void => {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `[Cloudinary] Missing environment variables: ${missing.join(", ")}. Configure them for server-side image uploads.`
    );
  }
};

let didConfigure = false;

/**
 * Returns the Cloudinary v2 SDK with credentials applied.
 * Safe to call multiple times; config runs once.
 */
export const getCloudinary = (): typeof cloudinarySdk => {
  assertCloudinaryEnv();
  if (!didConfigure) {
    cloudinarySdk.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
      api_key: process.env.CLOUDINARY_API_KEY!,
      api_secret: process.env.CLOUDINARY_API_SECRET!,
    });
    didConfigure = true;
  }
  return cloudinarySdk;
};

export default getCloudinary;
