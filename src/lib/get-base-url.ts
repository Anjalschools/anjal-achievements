/**
 * Absolute site origin for QR codes and public links (no trailing slash).
 *
 * - **Browser:** `window.location.origin` (always correct for the current host).
 * - **Server:** `NEXT_PUBLIC_APP_URL` (set in production, e.g. `https://anjal-achievements.com`).
 *
 * For SSR/build without `window`, set `NEXT_PUBLIC_APP_URL` in `.env.local` / deployment env.
 */
export const getBaseUrl = (): string => {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  return "http://localhost:3000";
};
