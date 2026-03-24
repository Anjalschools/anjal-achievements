import { NextRequest, NextResponse } from "next/server";
import { loadPublicPortfolioPayload } from "@/lib/public-portfolio-service";
import { getBaseUrlForRequest } from "@/lib/get-base-url";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { slug: string } };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const slug = String(params.slug || "").trim();
  const token = request.nextUrl.searchParams.get("token")?.trim() || "";
  const baseUrl = getBaseUrlForRequest(request);

  if (!token) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const data = await loadPublicPortfolioPayload(slug, token, { baseUrl });

  if (!data.ok) {
    if (data.error === "moved") {
      const u = new URL(request.url);
      u.pathname = `/api/public/portfolio/${encodeURIComponent(data.canonicalSlug)}`;
      u.search = `?token=${encodeURIComponent(data.token)}`;
      return NextResponse.redirect(u, 307);
    }
    const status = data.error === "forbidden" ? 403 : 404;
    return NextResponse.json({ ok: false, error: data.error }, { status });
  }

  return NextResponse.json(data, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
