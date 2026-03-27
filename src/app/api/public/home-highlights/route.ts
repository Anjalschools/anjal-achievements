import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import HomeHighlight from "@/models/HomeHighlight";
import { DEFAULT_HOME_HIGHLIGHTS, normalizeHomeHighlightPayload } from "@/lib/home-highlights";
import {
  getHomeHighlightsCached,
  setHomeHighlightsCached,
} from "@/lib/public-endpoints-cache";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CACHE_TTL_MS = 45_000;

const shouldUseApprovedDefaults = (data: ReturnType<typeof normalizeHomeHighlightPayload>) => {
  const totalItems = (data.blocks || []).reduce(
    (acc, block) => acc + (Array.isArray(block.items) ? block.items.length : 0),
    0
  );
  const isLegacyMainTitle =
    String(data.sectionTitleAr || data.sectionTitle || "").trim() ===
    "إبراز النماذج المتميزة والإنجازات البارزة";
  return isLegacyMainTitle || totalItems < 6;
};

const JSON_HEADERS = {
  headers: {
    "Cache-Control": "no-store, max-age=0",
  },
};

export async function GET() {
  try {
    const hit = getHomeHighlightsCached();
    if (hit) {
      return NextResponse.json(hit, JSON_HEADERS);
    }

    await connectDB();
    const row = await HomeHighlight.findOne({ isActive: true })
      .sort({ updatedAt: -1 })
      .select(
        "-__v"
      )
      .lean();

    const normalized = normalizeHomeHighlightPayload(row || {});
    const data = shouldUseApprovedDefaults(normalized) ? DEFAULT_HOME_HIGHLIGHTS : normalized;

    if (process.env.AI_DEBUG === "1") {
      const blocks = Array.isArray(data.blocks) ? data.blocks : [];
      const items = blocks.flatMap((b) => (Array.isArray(b.items) ? b.items : []));
      const classify = (src: string): "local" | "base64" | "external" | "empty" => {
        const t = String(src || "").trim();
        if (!t) return "empty";
        if (/^data:image\//i.test(t)) return "base64";
        if (/^https?:\/\//i.test(t)) return "external";
        if (t.startsWith("/")) return "local";
        return "empty";
      };
      console.info("[public-home-highlights] snapshot", {
        blocks: blocks.length,
        items: items.length,
        imageTypes: items.map((i) => classify(i.imageUrl)),
      });
    }

    const body = { ok: true as const, data };
    setHomeHighlightsCached(body, CACHE_TTL_MS);
    return NextResponse.json(body, JSON_HEADERS);
  } catch (error) {
    console.error("[GET /api/public/home-highlights]", error);
    return NextResponse.json({ ok: true, data: DEFAULT_HOME_HIGHLIGHTS });
  }
}
