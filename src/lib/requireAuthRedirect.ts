/**
 * Client-side auth navigation helpers: send guests to `/login?callbackUrl=…`
 * with an internal path only (open redirect safe).
 */

export const LOGIN_PATH = "/login";

const CALLBACK_PARAM = "callbackUrl";

/**
 * Returns a safe internal path for post-login redirect, or null if untrusted.
 */
export const sanitizeInternalCallbackPath = (raw: string | null | undefined): string | null => {
  if (raw == null || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t.startsWith("/")) return null;
  if (t.startsWith("//")) return null;
  if (t.includes("://")) return null;
  const lower = t.toLowerCase();
  if (lower.includes("javascript:") || lower.includes("\\")) return null;
  return t;
};

export const normalizeTargetPath = (targetPath: string): string =>
  targetPath.startsWith("/") ? targetPath : `/${targetPath}`;

export const buildLoginUrlWithCallback = (targetPath: string): string => {
  const path = normalizeTargetPath(targetPath);
  return `${LOGIN_PATH}?${CALLBACK_PARAM}=${encodeURIComponent(path)}`;
};

/**
 * @param navigate - e.g. `(url) => router.push(url)`
 */
export const requireAuthRedirect = (
  navigate: (url: string) => void,
  isLoggedIn: boolean,
  targetPath: string
): void => {
  const path = normalizeTargetPath(targetPath);
  if (isLoggedIn) navigate(path);
  else navigate(buildLoginUrlWithCallback(path));
};

/** Paths that must go through the guard when linked from public or ambiguous UI. */
export const isAuthGuardHref = (href: string): boolean => {
  const base = href.split("?")[0] || "";
  return base === "/achievements/new" || base === "/letter-requests/new";
};
