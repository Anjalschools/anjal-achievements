import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import connectDB from "@/lib/mongodb";
import NewsPost from "@/models/NewsPost";
import type { PublishTarget } from "@/models/NewsPost";
import { serializeNewsPost } from "@/lib/news-serialize";
import { ensurePublicSlug } from "@/lib/news-service";
import { blockingStrictNewsPublish, evaluatePlatformBlocking } from "@/lib/news-quality";
import { logAuditEvent, actorFromUser } from "@/lib/audit-log-service";
import type { IUser } from "@/models/User";
import { getSocialPublisher } from "@/lib/social-publishers";

export const dynamic = "force-dynamic";

const TARGETS: PublishTarget[] = ["website", "instagram", "x", "tiktok", "snapchat"];

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as { targets?: string[] };
    const rawTargets = Array.isArray(body.targets) ? body.targets : [];
    const targets = rawTargets.filter((t): t is PublishTarget =>
      TARGETS.includes(t as PublishTarget)
    );

    if (targets.length === 0) {
      return NextResponse.json({ error: "حدد منصة واحدة على الأقل" }, { status: 400 });
    }

    await connectDB();
    const doc = await NewsPost.findById(id);
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const st = String(doc.status);
    if (!["approved", "scheduled", "published"].includes(st)) {
      return NextResponse.json(
        { error: "يجب اعتماد الخبر أو أن يكون مجدولًا/منشورًا قبل النشر على المنصات" },
        { status: 400 }
      );
    }

    const slugStrEarly = String(doc.slug || "");
    const alreadyOnWebsiteEarly =
      st === "published" && slugStrEarly.length > 0 && !slugStrEarly.startsWith("draft-");
    const idempotentWebsiteOnly =
      alreadyOnWebsiteEarly && targets.length === 1 && targets[0] === "website";

    if (!idempotentWebsiteOnly) {
      const strictBlocks = blockingStrictNewsPublish({
        title: doc.title,
        websiteBody: doc.websiteBody,
        coverImage: doc.coverImage,
      });
      if (strictBlocks.length > 0) {
        await logAuditEvent({
          actionType: "news_publish_blocked",
          entityType: "news_post",
          entityId: id,
          entityTitle: doc.title,
          descriptionAr: "توقف النشر — عنوان أو صورة أو نص ناقص",
          outcome: "failure",
          actor: actorFromUser(gate.user as IUser),
          request,
          metadata: { blocks: strictBlocks, targets },
        });
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "NEWS_PUBLISH_VALIDATION",
              message: "أكمل العنوان وصورة الغلاف والنص قبل النشر",
              blocks: strictBlocks,
            },
          },
          { status: 400 }
        );
      }
    }

    await logAuditEvent({
      actionType: "news_publish_attempted",
      entityType: "news_post",
      entityId: id,
      entityTitle: doc.title,
      descriptionAr: `محاولة نشر على: ${targets.join(", ")}`,
      actor: actorFromUser(gate.user as IUser),
      request,
      metadata: { targets },
    });

    const isAr = true;
    const prevLen = (doc.publishResults || []).length;
    const newResults = [...(doc.publishResults || [])];
    const now = new Date();

    const slugStr = String(doc.slug || "");
    const alreadyOnWebsite = st === "published" && slugStr.length > 0 && !slugStr.startsWith("draft-");

    if (targets.includes("website")) {
      if (alreadyOnWebsite) {
        // idempotent — الموقع يعرض آخر نسخة من الحقول عبر التعديل
      } else {
        const publicSlug = await ensurePublicSlug(doc._id as mongoose.Types.ObjectId, doc.title);
        doc.slug = publicSlug;
        doc.status = "published";
        doc.publishedAt = now;
        doc.publishedBy = gate.user._id;
        doc.scheduledFor = undefined;
        doc.publishTargets = [...new Set([...(doc.publishTargets || []), "website"])] as PublishTarget[];

        newResults.push({
          target: "website",
          success: true,
          at: now,
        });

        await logAuditEvent({
          actionType: "news_published_website",
          entityType: "news_post",
          entityId: id,
          entityTitle: doc.title,
          descriptionAr: `تم نشر الخبر على الموقع — ${publicSlug}`,
          outcome: "success",
          platform: "website",
          actor: actorFromUser(gate.user as IUser),
          request,
          metadata: { slug: publicSlug },
        });
      }
    }

    const ctxPublish = {
      newsId: id,
      title: doc.title,
      coverImageUrl: doc.coverImage,
      caption: doc.instagramCaption,
      body: doc.xPostText || doc.websiteBody,
    };

    for (const t of targets) {
      if (t === "website") continue;

      const blocking = evaluatePlatformBlocking(
        t,
        {
          coverImage: doc.coverImage,
          instagramCaption: doc.instagramCaption,
          xPostText: doc.xPostText || doc.websiteBody,
        },
        isAr
      );
      if (blocking.length > 0) {
        newResults.push({
          target: t,
          success: false,
          at: now,
          errorMessage: blocking.join(" · "),
        });
        await logAuditEvent({
          actionType: "news_publish_platform",
          entityType: "news_post",
          entityId: id,
          entityTitle: doc.title,
          descriptionAr: `فشل التحقق قبل النشر على ${t}`,
          outcome: "failure",
          platform: t,
          actor: actorFromUser(gate.user as IUser),
          request,
          metadata: { blocking },
        });
        continue;
      }

      const pub = getSocialPublisher(t);
      if (!pub) continue;

      const ready = await pub.isReady();
      if (!ready) {
        newResults.push({
          target: t,
          success: false,
          at: now,
          errorMessage: "التكامل غير متصل أو غير جاهز",
        });
        await logAuditEvent({
          actionType: "news_publish_platform",
          entityType: "news_post",
          entityId: id,
          entityTitle: doc.title,
          descriptionAr: `تخطي النشر — ${t} غير متصل`,
          outcome: "failure",
          platform: t,
          actor: actorFromUser(gate.user as IUser),
          request,
        });
        continue;
      }

      const attempt = await pub.publish(ctxPublish);
      newResults.push({
        target: attempt.target,
        success: attempt.success,
        at: now,
        errorMessage: attempt.errorMessage,
        externalId: attempt.externalId,
      });

      if (attempt.success) {
        doc.publishTargets = [...new Set([...(doc.publishTargets || []), t])] as PublishTarget[];
      }

      await logAuditEvent({
        actionType: "news_publish_platform",
        entityType: "news_post",
        entityId: id,
        entityTitle: doc.title,
        descriptionAr: attempt.success ? `نشر على ${t}` : `فشل نشر على ${t}`,
        outcome: attempt.success ? "success" : "failure",
        platform: t,
        actor: actorFromUser(gate.user as IUser),
        request,
        metadata: { externalId: attempt.externalId, detail: attempt.errorMessage },
      });
    }

    const batchResults = newResults.slice(prevLen);
    const socialSuccessInBatch = batchResults.some((r) => r.target !== "website" && r.success);

    if (socialSuccessInBatch && ["approved", "scheduled"].includes(String(doc.status))) {
      doc.status = "published";
      doc.publishedAt = doc.publishedAt || now;
      doc.publishedBy = doc.publishedBy || gate.user._id;
      doc.scheduledFor = undefined;
    }

    if (String(doc.status) === "scheduled" && (targets.includes("website") || socialSuccessInBatch)) {
      doc.scheduledFor = undefined;
    }

    doc.publishResults = newResults;
    await doc.save();

    return NextResponse.json({ ok: true, item: serializeNewsPost(doc.toObject()) });
  } catch (e) {
    console.error("[POST publish]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
