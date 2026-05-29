import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { requireAchievementReviewer } from "@/lib/review-auth";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import AnalyticsSavedView, {
  type AnalyticsSavedViewScope,
  type AnalyticsSavedViewUiState,
} from "@/models/AnalyticsSavedView";
import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

const parseScope = (v: string | null): AnalyticsSavedViewScope | null => {
  if (v === "participation" || v === "reports") return v;
  return null;
};

export async function GET(request: NextRequest) {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;
  if (!roleHasCapability(String(gate.user.role), "reports")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const scope = parseScope(searchParams.get("scope"));
    const slug = searchParams.get("slug")?.trim();

    if (slug) {
      const doc = await AnalyticsSavedView.findOne({ shareSlug: slug }).lean();
      if (!doc) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
      return NextResponse.json({
        ok: true,
        view: {
          id: String(doc._id),
          name: doc.name,
          scope: doc.scope,
          filterSnapshot: doc.filterSnapshot,
          uiSnapshot: doc.uiSnapshot,
          shareSlug: doc.shareSlug,
          updatedAt: doc.updatedAt,
        },
      });
    }

    const userId = gate.user._id ?? (gate.user as { id?: string }).id;
    const q: Record<string, unknown> = { createdBy: userId };
    if (scope) q.scope = scope;
    const rows = await AnalyticsSavedView.find(q).sort({ updatedAt: -1 }).limit(50).lean();

    return NextResponse.json({
      ok: true,
      views: rows.map((doc) => ({
        id: String(doc._id),
        name: doc.name,
        scope: doc.scope,
        filterSnapshot: doc.filterSnapshot,
        uiSnapshot: doc.uiSnapshot,
        shareSlug: doc.shareSlug,
        updatedAt: doc.updatedAt,
      })),
    });
  } catch (e) {
    return jsonInternalServerError(e);
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;
  if (!roleHasCapability(String(gate.user.role), "reports")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await connectDB();
    const body = (await request.json()) as {
      name?: string;
      scope?: AnalyticsSavedViewScope;
      filterSnapshot?: ExecutiveFilterSnapshot;
      uiSnapshot?: AnalyticsSavedViewUiState;
      createShareSlug?: boolean;
    };

    const name = String(body.name || "").trim();
    const scope = parseScope(body.scope ?? null);
    if (!name || name.length < 2) {
      return NextResponse.json({ ok: false, error: "Invalid name" }, { status: 400 });
    }
    if (!scope) {
      return NextResponse.json({ ok: false, error: "Invalid scope" }, { status: 400 });
    }
    if (!body.filterSnapshot || typeof body.filterSnapshot !== "object") {
      return NextResponse.json({ ok: false, error: "Missing filterSnapshot" }, { status: 400 });
    }

    const shareSlug = body.createShareSlug
      ? `av-${randomBytes(6).toString("hex")}`
      : undefined;

    const doc = await AnalyticsSavedView.create({
      name,
      scope,
      createdBy: gate.user._id ?? (gate.user as { id?: string }).id,
      filterSnapshot: body.filterSnapshot,
      uiSnapshot: body.uiSnapshot ?? {},
      shareSlug,
    });

    return NextResponse.json({
      ok: true,
      view: {
        id: String(doc._id),
        name: doc.name,
        scope: doc.scope,
        filterSnapshot: doc.filterSnapshot,
        uiSnapshot: doc.uiSnapshot,
        shareSlug: doc.shareSlug,
        updatedAt: doc.updatedAt,
      },
    });
  } catch (e) {
    return jsonInternalServerError(e);
  }
}

export async function DELETE(request: NextRequest) {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;
  if (!roleHasCapability(String(gate.user.role), "reports")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

    const userId = gate.user._id ?? (gate.user as { id?: string }).id;
    const res = await AnalyticsSavedView.deleteOne({ _id: id, createdBy: userId });
    if (res.deletedCount === 0) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonInternalServerError(e);
  }
}
