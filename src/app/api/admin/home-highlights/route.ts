import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import HomeHighlight from "@/models/HomeHighlight";
import { DEFAULT_HOME_HIGHLIGHTS, normalizeHomeHighlightPayload } from "@/lib/home-highlights";
import { requireHomeHighlightsAdmin } from "@/lib/home-highlights-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const shouldUseApprovedDefaults = (data: ReturnType<typeof normalizeHomeHighlightPayload>) => {
  const totalItems = (data.blocks || []).reduce(
    (acc, block) => acc + (Array.isArray(block.items) ? block.items.length : 0),
    0
  );
  const isLegacyMainTitle = String(data.sectionTitleAr || data.sectionTitle || "").trim() ===
    "إبراز النماذج المتميزة والإنجازات البارزة";
  return isLegacyMainTitle || totalItems < 6;
};

export async function GET() {
  const gate = await requireHomeHighlightsAdmin();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const row = await HomeHighlight.findOne({ isActive: true }).sort({ updatedAt: -1 }).lean();
    const normalized = normalizeHomeHighlightPayload(row || {});
    const data = shouldUseApprovedDefaults(normalized) ? DEFAULT_HOME_HIGHLIGHTS : normalized;
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("[GET /api/admin/home-highlights]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const gate = await requireHomeHighlightsAdmin();
  if (!gate.ok) return gate.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const data = normalizeHomeHighlightPayload(body);
    await connectDB();
    await HomeHighlight.updateMany({ isActive: true }, { $set: { isActive: false } });
    const created = await HomeHighlight.create({
      sectionEnabled: data.sectionEnabled ?? true,
      layoutColumns: data.layoutColumns ?? 3,
      sectionTitleAr: data.sectionTitleAr,
      sectionTitleEn: data.sectionTitleEn,
      sectionSubtitleAr: data.sectionSubtitleAr,
      sectionSubtitleEn: data.sectionSubtitleEn,
      sectionTitle: data.sectionTitle,
      sectionSubtitle: data.sectionSubtitle,
      blocks: data.blocks,
      participationSectionEnabled: data.participationSectionEnabled ?? true,
      participationTitleAr: data.participationTitleAr,
      participationTitleEn: data.participationTitleEn,
      participationSubtitleAr: data.participationSubtitleAr,
      participationSubtitleEn: data.participationSubtitleEn,
      participationBlocks: data.participationBlocks || [],
      studentShowcaseTitleAr: data.studentShowcaseTitleAr,
      studentShowcaseTitleEn: data.studentShowcaseTitleEn,
      studentShowcaseSubtitleAr: data.studentShowcaseSubtitleAr,
      studentShowcaseSubtitleEn: data.studentShowcaseSubtitleEn,
      studentShowcaseFilters: data.studentShowcaseFilters || [],
      studentShowcaseItems: data.studentShowcaseItems || [],
      isActive: true,
    });
    return NextResponse.json({ ok: true, data: normalizeHomeHighlightPayload(created.toObject()) });
  } catch (error) {
    console.error("[PUT /api/admin/home-highlights]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const gate = await requireHomeHighlightsAdmin();
  if (!gate.ok) return gate.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    await connectDB();
    const current = await HomeHighlight.findOne({ isActive: true }).sort({ updatedAt: -1 }).lean();
    const merged = normalizeHomeHighlightPayload({
      ...(current || {}),
      ...body,
    });
    const updated = await HomeHighlight.findOneAndUpdate(
      { isActive: true },
      {
        $set: {
          sectionEnabled: merged.sectionEnabled ?? true,
          layoutColumns: merged.layoutColumns ?? 3,
          sectionTitleAr: merged.sectionTitleAr,
          sectionTitleEn: merged.sectionTitleEn,
          sectionSubtitleAr: merged.sectionSubtitleAr,
          sectionSubtitleEn: merged.sectionSubtitleEn,
          sectionTitle: merged.sectionTitle,
          sectionSubtitle: merged.sectionSubtitle,
          blocks: merged.blocks,
          participationSectionEnabled: merged.participationSectionEnabled ?? true,
          participationTitleAr: merged.participationTitleAr,
          participationTitleEn: merged.participationTitleEn,
          participationSubtitleAr: merged.participationSubtitleAr,
          participationSubtitleEn: merged.participationSubtitleEn,
          participationBlocks: merged.participationBlocks || [],
          studentShowcaseTitleAr: merged.studentShowcaseTitleAr,
          studentShowcaseTitleEn: merged.studentShowcaseTitleEn,
          studentShowcaseSubtitleAr: merged.studentShowcaseSubtitleAr,
          studentShowcaseSubtitleEn: merged.studentShowcaseSubtitleEn,
          studentShowcaseFilters: merged.studentShowcaseFilters || [],
          studentShowcaseItems: merged.studentShowcaseItems || [],
          isActive: true,
        },
      },
      { upsert: true, new: true }
    ).lean();

    return NextResponse.json({ ok: true, data: normalizeHomeHighlightPayload(updated || merged) });
  } catch (error) {
    console.error("[PATCH /api/admin/home-highlights]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

