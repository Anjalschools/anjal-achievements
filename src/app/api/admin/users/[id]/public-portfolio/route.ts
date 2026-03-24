import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import type { IUser } from "@/models/User";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import { adminUpdatePublicPortfolio, getAdminPublicPortfolioState } from "@/lib/admin-users-service";
import { logAuditEvent, actorFromUser } from "@/lib/audit-log-service";

export const dynamic = "force-dynamic";

type RouteParams = { params: { id: string } };

const actorId = (u: unknown): string => {
  const o = u as { _id?: unknown };
  return o._id ? String(o._id) : "";
};

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;

  const id = params.id;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const state = await getAdminPublicPortfolioState(id);
    return NextResponse.json(state);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    console.error("[GET /api/admin/users/[id]/public-portfolio]", e);
    const status = msg.includes("not found") ? 404 : msg.includes("only for students") ? 400 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;

  const id = params.id;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const enabled = body.enabled === undefined ? undefined : Boolean(body.enabled);
    const regenerateToken = Boolean(body.regenerateToken);
    const regenerateSlug = Boolean(body.regenerateSlug);

    const before = await getAdminPublicPortfolioState(id);

    const result = await adminUpdatePublicPortfolio(
      id,
      { enabled, regenerateToken, regenerateSlug },
      actorId(gate.user)
    );

    const intendedChange =
      typeof body.enabled === "boolean" || regenerateToken || regenerateSlug;

    if (intendedChange) {
      await logAuditEvent({
        actionType: "user_public_portfolio_updated",
        entityType: "user",
        entityId: id,
        descriptionAr: "تحديث ملف الإنجاز العام للطالب (تفعيل/إيقاف أو إعادة توليد الرابط)",
        before: {
          publicPortfolioEnabled: before.publicPortfolioEnabled,
          publicPortfolioSlug: before.publicPortfolioSlug,
          publicPortfolioPublishedAt: before.publicPortfolioPublishedAt,
        },
        after: {
          publicPortfolioEnabled: result.publicPortfolioEnabled,
          publicPortfolioSlug: result.publicPortfolioSlug,
          publicPortfolioPublishedAt: result.publicPortfolioPublishedAt,
        },
        metadata: {
          requestedEnabled: enabled,
          regenerateToken,
          regenerateSlug,
        },
        actor: actorFromUser(gate.user as IUser),
        request,
      });
    }

    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    console.error("[PATCH /api/admin/users/[id]/public-portfolio]", e);
    const status = msg.includes("not found") ? 404 : msg.includes("only for students") ? 400 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
