import { NextRequest, NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { buildApprovedStudentsPdf } from "@/lib/partnerships/approved-students-pdf-service";
import { requirePartnershipsView } from "@/lib/partnerships/partnerships-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const gate = await requirePartnershipsView();
  if (!gate.ok) return gate.response;

  const institutionId = request.nextUrl.searchParams.get("institutionId")?.trim() || "";
  const schoolYearId = request.nextUrl.searchParams.get("schoolYearId")?.trim() || "";

  if (!institutionId || !schoolYearId) {
    return NextResponse.json(
      { error: "institutionId and schoolYearId are required" },
      { status: 400 }
    );
  }

  try {
    const { buffer, context } = await buildApprovedStudentsPdf({ institutionId, schoolYearId });
    const filename = `approved-students-${institutionId}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Report-Rows": String(context.rows.length),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    const status =
      message.includes("not found") || message.includes("Invalid") ? 404 : 500;
    if (status === 500) console.error("[GET /api/training/reports/approved-students]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
