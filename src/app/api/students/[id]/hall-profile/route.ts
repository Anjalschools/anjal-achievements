import { NextRequest, NextResponse } from "next/server";
import { buildStudentHallProfile } from "@/lib/hall-of-fame-service";

export const dynamic = "force-dynamic";

type RouteParams = { params: { id: string } };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const locale = request.nextUrl.searchParams.get("locale") === "en" ? "en" : "ar";
    const data = await buildStudentHallProfile(params.id, locale);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (e) {
    console.error("[GET hall-profile]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
