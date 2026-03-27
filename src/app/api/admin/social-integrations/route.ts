import { NextRequest, NextResponse } from "next/server";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import connectDB from "@/lib/mongodb";
import SocialIntegration from "@/models/SocialIntegration";
import type { SocialProvider } from "@/models/SocialIntegration";
import { encryptSecret, isTokenEncryptionConfigured } from "@/lib/token-crypto";
import { logAuditEvent, actorFromUser } from "@/lib/audit-log-service";
import type { IUser } from "@/models/User";
import { jsonInternalServerError } from "@/lib/api-safe-response";

export const dynamic = "force-dynamic";

const PROVIDERS: SocialProvider[] = ["instagram", "x", "tiktok", "snapchat"];

const ensureRows = async () => {
  for (const provider of PROVIDERS) {
    await SocialIntegration.updateOne(
      { provider },
      { $setOnInsert: { provider, status: "disconnected", scopes: [] } },
      { upsert: true }
    );
  }
};

export async function GET() {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    await ensureRows();

    const items = await Promise.all(
      PROVIDERS.map(async (provider) => {
        const r = await SocialIntegration.findOne({ provider })
          .select(
            "provider status accountLabel accountId scopes tokenExpiresAt lastSyncAt lastPublishAt metadata"
          )
          .select("+encryptedAccessToken +encryptedRefreshToken")
          .lean();

        const hasAccess = Boolean(r?.encryptedAccessToken);
        const hasRefresh = Boolean(r?.encryptedRefreshToken);

        return {
          provider,
          status: r?.status ?? "disconnected",
          accountLabel: r?.accountLabel,
          accountId: r?.accountId,
          scopes: r?.scopes ?? [],
          tokenExpiresAt: r?.tokenExpiresAt ? new Date(r.tokenExpiresAt).toISOString() : null,
          lastSyncAt: r?.lastSyncAt ? new Date(r.lastSyncAt).toISOString() : null,
          lastPublishAt: r?.lastPublishAt ? new Date(r.lastPublishAt).toISOString() : null,
          hasStoredTokens: hasAccess || hasRefresh,
          tokenEncryptionConfigured: isTokenEncryptionConfigured(),
        };
      })
    );

    return NextResponse.json({ ok: true, items });
  } catch (e) {
    console.error("[GET social-integrations]", e);
    return jsonInternalServerError(e);
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action || "");
    const provider = String(body.provider || "") as SocialProvider;
    if (!PROVIDERS.includes(provider)) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    await connectDB();
    await ensureRows();

    if (action === "disconnect") {
      await SocialIntegration.updateOne(
        { provider },
        {
          $set: { status: "disconnected" },
          $unset: {
            encryptedAccessToken: "",
            encryptedRefreshToken: "",
            tokenExpiresAt: "",
          },
        }
      );
      await logAuditEvent({
        actionType: "social_integration_disconnect",
        entityType: "social_integration",
        entityId: provider,
        descriptionAr: `فصل تكامل ${provider}`,
        outcome: "success",
        platform: provider,
        actor: actorFromUser(gate.user as IUser),
        request,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "test") {
      const row = await SocialIntegration.findOne({ provider }).lean();
      const ok = row?.status === "connected";
      await logAuditEvent({
        actionType: "social_integration_test",
        entityType: "social_integration",
        entityId: provider,
        descriptionAr: ok ? `اختبار تكامل ${provider}: جاهز` : `اختبار تكامل ${provider}: غير متصل`,
        outcome: ok ? "success" : "failure",
        platform: provider,
        actor: actorFromUser(gate.user as IUser),
        request,
      });
      return NextResponse.json({
        ok: true,
        result: ok ? "connected" : "not_connected",
        messageAr: ok
          ? "التكامل يظهر كمتصل — جرّب النشر بعد إكمال واجهات المنصة الرسمية."
          : "الحساب غير متصل. أكمل OAuth أو أدخل رموز الوصول عبر مسار رسمي.",
      });
    }

    if (action === "connect") {
      if (!isTokenEncryptionConfigured()) {
        return NextResponse.json(
          {
            error:
              "لم يُضبط SOCIAL_TOKEN_ENCRYPTION_KEY — لا يمكن تخزين رموز الوصول بأمان على الخادم.",
          },
          { status: 400 }
        );
      }

      const accessToken = String(body.accessToken || "").trim();
      const refreshToken = String(body.refreshToken || "").trim();
      const accountLabel = String(body.accountLabel || "").trim();
      const accountId = String(body.accountId || "").trim();

      if (!accessToken) {
        return NextResponse.json({ error: "accessToken مطلوب (من OAuth الرسمي)" }, { status: 400 });
      }

      const encA = encryptSecret(accessToken);
      const encR = refreshToken ? encryptSecret(refreshToken) : null;
      if (!encA) {
        return jsonInternalServerError(new Error("encrypt_failed"), {
          fallbackMessage: "فشل تشفير الرمز",
        });
      }

      await SocialIntegration.findOneAndUpdate(
        { provider },
        {
          $set: {
            encryptedAccessToken: encA,
            encryptedRefreshToken: encR || undefined,
            status: "connected",
            accountLabel: accountLabel || undefined,
            accountId: accountId || undefined,
            lastSyncAt: new Date(),
          },
          $setOnInsert: { provider, scopes: [] },
        },
        { upsert: true, new: true }
      );

      await logAuditEvent({
        actionType: "social_integration_connect",
        entityType: "social_integration",
        entityId: provider,
        descriptionAr: `ربط حساب ${provider}${accountLabel ? ` — ${accountLabel}` : ""}`,
        outcome: "success",
        platform: provider,
        actor: actorFromUser(gate.user as IUser),
        request,
        metadata: { hasRefresh: Boolean(encR) },
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("[POST social-integrations]", e);
    return jsonInternalServerError(e);
  }
}
