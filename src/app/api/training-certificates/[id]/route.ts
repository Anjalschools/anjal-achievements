import { NextRequest, NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { getTrainingCertificatePayload } from "@/lib/partnerships/training-achievements-query";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { id: string } };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const id = String(params.id || "").trim();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const item = await getTrainingCertificatePayload(id);
    if (!item) {
      return NextResponse.json({ error: "Training certificate not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    console.error("[GET /api/training-certificates/[id]]", error);
    return jsonInternalServerError(error);
  }
}
