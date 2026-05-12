import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import AlumniCohort from "@/models/AlumniCohort";
import { requireAlumniAdministrationActor } from "@/lib/admin-user-management-auth";
import { sanitizeMongoShape } from "@/lib/sanitize-input";
import { sanitizeUserText } from "@/lib/sanitize-html";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAlumniAdministrationActor();
  if (!gate.ok) return gate.response;
  try {
    await connectDB();
    const rows = await AlumniCohort.find({}).sort({ graduationYear: -1 }).limit(200).lean();
    return NextResponse.json({
      ok: true,
      items: rows.map((row: any) => ({
        id: row._id.toString(),
        graduationYear: row.graduationYear,
        track: row.track || "",
        stage: row.stage || "",
        label: row.label || "",
        featured: row.featured === true,
      })),
    });
  } catch (error) {
    console.error("[GET /api/admin/alumni/cohorts]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireAlumniAdministrationActor();
  if (!gate.ok) return gate.response;
  try {
    const body = sanitizeMongoShape((await request.json()) as Record<string, unknown>);
    const graduationYear = Number(body.graduationYear);
    if (!Number.isFinite(graduationYear)) return NextResponse.json({ error: "INVALID_YEAR" }, { status: 400 });

    await connectDB();
    const row = await AlumniCohort.create({
      graduationYear,
      track: sanitizeUserText(String(body.track || "")) || undefined,
      stage: sanitizeUserText(String(body.stage || "")) || undefined,
      label: sanitizeUserText(String(body.label || "")) || undefined,
      featured: body.featured === true,
    });
    return NextResponse.json({ ok: true, id: row._id.toString() }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/alumni/cohorts]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
