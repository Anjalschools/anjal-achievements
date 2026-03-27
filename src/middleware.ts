import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  buildContentSecurityPolicy,
  buildReportOnlyContentSecurityPolicy,
  buildReportToHeaderValue,
  CSP_NONCE_HEADER,
  CSP_REPORT_PATH,
  generateCspNonce,
} from "@/lib/csp";

const IS_DEV = process.env.NODE_ENV === "development";

export const middleware = (request: NextRequest) => {
  const nonce = generateCspNonce();
  const reportAbsoluteUrl = `${request.nextUrl.origin}${CSP_REPORT_PATH}`;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CSP_NONCE_HEADER, nonce);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const enforced = buildContentSecurityPolicy(nonce, { isDevelopment: IS_DEV });
  const reportOnly = buildReportOnlyContentSecurityPolicy(nonce, { isDevelopment: IS_DEV }, {
    reportAbsoluteUrl,
  });

  response.headers.set("Content-Security-Policy", enforced);
  response.headers.set("Content-Security-Policy-Report-Only", reportOnly);
  response.headers.set("Report-To", buildReportToHeaderValue(reportAbsoluteUrl));
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );

  return response;
};

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
