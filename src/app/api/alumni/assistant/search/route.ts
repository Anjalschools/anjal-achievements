import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { requireSessionUser } from "@/lib/alumni/require-alumni";
import { searchAlumniDirectory } from "@/lib/alumni/ai/alumni-text-search";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = await requireSessionUser();
  if (!gate.ok) return gate.response;

  try {
    const body = (await request.json()) as { q?: string };
    const q = typeof body.q === "string" ? body.q : "";
    if (q.trim().length < 2) {
      return NextResponse.json({ ok: true, items: [], engine: "internal" });
    }

    await connectDB();
    const items = await searchAlumniDirectory(q, 20);

    return NextResponse.json({
      ok: true,
      engine: "internal",
      query: q.trim(),
      items,
    });
  } catch (error) {
    console.error("[POST /api/alumni/assistant/search]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}

/** Lightweight GET for tooling */
export async function GET(request: Request) {
  const gate = await requireSessionUser();
  if (!gate.ok) return gate.response;
  const q = new URL(request.url).searchParams.get("q") || "";
  try {
    await connectDB();
    const items = await searchAlumniDirectory(q, 20);
    return NextResponse.json({ ok: true, engine: "internal", query: q, items });
  } catch (error) {
    console.error("[GET /api/alumni/assistant/search]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
