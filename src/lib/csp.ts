/**
 * Content-Security-Policy helpers (Edge-safe). Used by src/middleware.ts and read in root layout via x-nonce.
 */

export const CSP_NONCE_HEADER = "x-nonce" as const;

/** Group name referenced by CSP `report-to` + `Report-To` header (must match). */
export const CSP_REPORT_TO_GROUP = "csp-endpoint" as const;

/** Path-only (same-origin) for CSP report-uri / report-to URLs. */
export const CSP_REPORT_PATH = "/api/security/csp-report" as const;

/** 128-bit random nonce, base64 (CSP-compatible). */
export function generateCspNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export type BuildCspOptions = {
  isDevelopment: boolean;
};

/** Shared directive list for both enforced and report-only policies (no TT / no reporting). */
function buildCoreCspDirectives(nonce: string, options: BuildCspOptions): string[] {
  const { isDevelopment } = options;

  const scriptDirectives = [`'self'`, `'nonce-${nonce}'`, "'strict-dynamic'"];
  if (isDevelopment) {
    scriptDirectives.push("'unsafe-eval'");
  }

  /*
   * style-src: do NOT include 'nonce-*' here. In CSP Level 3, a nonce in style-src causes
   * 'unsafe-inline' to be ignored, which breaks inline style attributes, styled-jsx, and some
   * Next.js-injected styles. Nonce remains on script-src + <html nonce> for scripts only.
   */
  const styleDirectives = ["'self'", "'unsafe-inline'"];

  /** Google Maps embed (contact page iframe): explicit hosts; paths like /maps are not CSP sources. */
  const frameSrcDirectives = [
    "'self'",
    "https://www.google.com",
    "https://maps.google.com",
    "https://maps.gstatic.com",
    "https://*.googleusercontent.com",
  ];

  return [
    "default-src 'self'",
    `script-src ${scriptDirectives.join(" ")}`,
    `style-src ${styleDirectives.join(" ")}`,
    "img-src 'self' data: https:",
    "connect-src 'self'",
    "font-src 'self' data: https:",
    `frame-src ${frameSrcDirectives.join(" ")}`,
    "object-src 'none'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
}

/**
 * Enforced CSP (no Trusted Types enforcement here — TT stays in Report-Only until stable).
 *
 * - script-src: 'nonce-*' + 'strict-dynamic' (no 'unsafe-inline' for scripts).
 * - Development: 'unsafe-eval' for HMR.
 * - style-src: 'self' + 'unsafe-inline' (no style nonce — see comment in buildCoreCspDirectives).
 */
export function buildContentSecurityPolicy(nonce: string, options: BuildCspOptions): string {
  return buildCoreCspDirectives(nonce, options).join("; ");
}

export type ReportOnlyCspEndpoints = {
  /** Absolute URL, e.g. https://example.com/api/security/csp-report */
  reportAbsoluteUrl: string;
};

/**
 * Report-Only CSP: same core as enforced + Trusted Types (monitoring) + reporting.
 * Browsers report violations without blocking (paired with Content-Security-Policy-Report-Only header).
 *
 * Trusted Types policy names are forward-looking (nextjs / react-dom) for when runtimes register policies;
 * violations surface via reports without breaking the app in Report-Only mode.
 */
export function buildReportOnlyContentSecurityPolicy(
  nonce: string,
  options: BuildCspOptions,
  endpoints: ReportOnlyCspEndpoints
): string {
  const { reportAbsoluteUrl } = endpoints;
  const core = buildCoreCspDirectives(nonce, options);
  return [
    ...core,
    "require-trusted-types-for 'script'",
    "trusted-types nextjs react-dom default",
    `report-uri ${reportAbsoluteUrl}`,
    `report-to ${CSP_REPORT_TO_GROUP}`,
  ].join("; ");
}

/** JSON value for `Report-To` response header (Reporting API — pairs with `report-to` in CSP). */
export function buildReportToHeaderValue(reportAbsoluteUrl: string): string {
  return JSON.stringify({
    group: CSP_REPORT_TO_GROUP,
    max_age: 10886400,
    endpoints: [{ url: reportAbsoluteUrl }],
  });
}
