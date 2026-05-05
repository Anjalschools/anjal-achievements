import "server-only";

/** e.g. `c***@gmail.com` — safe for server logs */
export const maskEmailForLogs = (email: string): string => {
  const s = email.trim().toLowerCase();
  const at = s.indexOf("@");
  if (at < 0) return "***";
  const local = s.slice(0, at);
  const domain = s.slice(at + 1);
  if (!domain) return "***";
  const head = local.length > 0 ? local[0] : "*";
  return `${head}***@${domain}`;
};

export const isDevNodeEnv = (): boolean => process.env.NODE_ENV !== "production";
