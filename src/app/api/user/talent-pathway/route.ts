import { NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { requireSession } from "@/lib/auth-guard";
import {
  buildStudentAlumniTalentPreparation,
  buildStudentTalentPathway,
} from "@/lib/talent-pathway/talent-pathway-intelligence-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const role = String(gate.user.role || "").trim();
  if (role !== "student" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const view = String(url.searchParams.get("view") || "pathway").trim();

    if (view === "alumni-preparation") {
      const preparation = await buildStudentAlumniTalentPreparation(String(gate.user._id));
      return NextResponse.json({ ok: true, preparation });
    }

    const pathway = await buildStudentTalentPathway(String(gate.user._id));
    return NextResponse.json({ ok: true, pathway });
  } catch (error) {
    console.error("[GET /api/user/talent-pathway]", error);
    return jsonInternalServerError(error);
  }
}
