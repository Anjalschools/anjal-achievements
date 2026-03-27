import { NextRequest, NextResponse } from "next/server";

type LegacyCspBody = {
  "csp-report"?: {
    "document-uri"?: string;
    "blocked-uri"?: string;
    "violated-directive"?: string;
    "effective-directive"?: string;
    "original-policy"?: string;
    "source-file"?: string;
    "line-number"?: number;
    "column-number"?: number;
    disposition?: string;
  };
};

const extractReport = (body: unknown): LegacyCspBody["csp-report"] | null => {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  if ("csp-report" in o && o["csp-report"] && typeof o["csp-report"] === "object") {
    return o["csp-report"] as LegacyCspBody["csp-report"];
  }
  /* Reporting API batch: [{ type, body: { ... } }] */
  if (Array.isArray(body) && body[0] && typeof body[0] === "object") {
    const first = body[0] as Record<string, unknown>;
    if (first.body && typeof first.body === "object") {
      return first.body as LegacyCspBody["csp-report"];
    }
  }
  return null;
};

const logViolation = (body: unknown) => {
  const report = extractReport(body) ?? (body as LegacyCspBody["csp-report"]);
  console.error("[CSP violation]", {
    documentUri: report?.["document-uri"],
    blockedUri: report?.["blocked-uri"],
    violatedDirective: report?.["violated-directive"] ?? report?.["effective-directive"],
    disposition: report?.disposition,
    sourceFile: report?.["source-file"],
  });
};

/**
 * CSP / Reporting API ingestion. No auth; do not echo sensitive data.
 * Accepts application/json and application/csp-report (JSON body).
 */
export async function POST(req: NextRequest) {
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("json") && !ct.includes("csp-report")) {
    return NextResponse.json({ ok: false, error: "unsupported_media_type" }, { status: 415 });
  }

  try {
    const raw = await req.text();
    if (!raw.trim()) {
      return NextResponse.json({ ok: true });
    }
    const body = JSON.parse(raw) as unknown;
    if (Array.isArray(body)) {
      for (const item of body) {
        logViolation(item);
      }
    } else {
      logViolation(body);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

/** Manual check that the endpoint exists (reports use POST from the browser). */
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "CSP reports: POST JSON here (browser sends automatically on violations).",
  });
}
