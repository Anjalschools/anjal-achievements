import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getCurrentDbUser } from "@/lib/auth";
import User from "@/models/User";
import { buildPublicPortfolioUrl } from "@/lib/public-portfolio";
import { getBaseUrlForRequest, tokenPreviewForLogs } from "@/lib/get-base-url";
import { ensureStudentPublicPortfolioReady } from "@/lib/public-portfolio-bootstrap";

export const dynamic = "force-dynamic";

/**
 * Current student only: full public URL + token for own portfolio (when enabled).
 * Does not allow enabling/disabling or regenerating.
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const user = await getCurrentDbUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (String(user.role || "") !== "student") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await ensureStudentPublicPortfolioReady(user._id.toString());

    const row = await User.findById(user._id)
      .select("+publicPortfolioToken publicPortfolioEnabled publicPortfolioSlug publicPortfolioPublishedAt")
      .lean();

    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const r = row as unknown as Record<string, unknown>;
    const enabled = r.publicPortfolioEnabled === true;
    const slug =
      typeof r.publicPortfolioSlug === "string" && r.publicPortfolioSlug.trim()
        ? r.publicPortfolioSlug.trim().toLowerCase()
        : "";
    const token =
      typeof r.publicPortfolioToken === "string" && r.publicPortfolioToken.trim()
        ? r.publicPortfolioToken.trim()
        : "";
    const publishedAt =
      r.publicPortfolioPublishedAt instanceof Date
        ? r.publicPortfolioPublishedAt.toISOString()
        : null;

    const baseUrl = getBaseUrlForRequest(request);
    const publicUrl =
      enabled && slug && token ? buildPublicPortfolioUrl({ slug, token, baseUrl }) : null;
    const qrValue = publicUrl;

    const outcome =
      !enabled
        ? "disabled"
        : !slug || !token
          ? "missing_slug_or_token"
          : publicUrl
            ? "ok"
            : "missing_slug_or_token";

    console.info("[api/user/public-portfolio] response", {
      userId: user._id.toString(),
      enabled,
      hasSlug: Boolean(slug),
      hasToken: Boolean(token),
      publicUrl: publicUrl ?? null,
      slug: slug || null,
      tokenPreview: token ? tokenPreviewForLogs(token) : null,
      baseUrlUsed: baseUrl,
      outcome,
    });

    return NextResponse.json({
      enabled,
      publicUrl,
      slug: enabled ? slug || null : null,
      token: enabled && token ? token : null,
      qrValue,
      publishedAt,
    });
  } catch (e) {
    console.error("[GET /api/user/public-portfolio]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
