import { NextRequest, NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { requireStudentApplicant } from "@/lib/partnerships/partnerships-auth";
import { generateStudentInstitutionReportTemplatePdf } from "@/lib/partnerships/training-completion-institution-template-service";
import { InstitutionReportPdfRenderError } from "@/lib/partnerships/institution-report-blank-template-pdf-generator";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const LOG_PREFIX = "[GET /api/partnerships/final-reports/institution-template]";

const logRoute = (step: string, payload: Record<string, unknown>) => {
  console.info(LOG_PREFIX, step, payload);
};

const logRouteError = (step: string, error: unknown, payload: Record<string, unknown> = {}) => {
  const base = error instanceof Error ? error : new Error(String(error));
  console.error(LOG_PREFIX, step, {
    ...payload,
    errorType: base.name,
    errorMessage: base.message,
    stack: base.stack,
  });
};

export async function GET(request: NextRequest) {
  const applicationId = String(request.nextUrl.searchParams.get("applicationId") || "").trim();

  const gate = await requireStudentApplicant();
  if (!gate.ok) {
    logRoute("auth-denied", { applicationId });
    return gate.response;
  }

  logRoute("request-received", {
    applicationId: applicationId || null,
    authenticatedUserId: String(gate.user._id),
  });

  try {
    const result = await generateStudentInstitutionReportTemplatePdf({
      studentId: gate.user._id,
      applicationId: applicationId || undefined,
    });

    if (!result.ok) {
      logRoute("application-not-found", {
        applicationId: applicationId || null,
        authenticatedUserId: String(gate.user._id),
        error: result.error,
      });
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    logRoute("pdf-export-success", {
      applicationId: applicationId || null,
      authenticatedUserId: String(gate.user._id),
      fileName: result.fileName,
      bytes: result.buffer.length,
    });

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(result.fileName)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof InstitutionReportPdfRenderError) {
      logRouteError("pdf-render-exception", error, {
        applicationId: applicationId || null,
        authenticatedUserId: String(gate.user._id),
        renderStage: error.stage,
      });
    } else {
      logRouteError("unhandled-exception", error, {
        applicationId: applicationId || null,
        authenticatedUserId: String(gate.user._id),
      });
    }

    return jsonInternalServerError(error, {
      fallbackMessage: "Institution report template export failed",
      merge:
        error instanceof InstitutionReportPdfRenderError
          ? { stage: error.stage }
          : undefined,
    });
  }
}
