import { PlaceholderPublisher } from "@/lib/social-publishers/base";
import type { PublishContext, PublishAttemptResult } from "@/lib/social-publishers/types";
import connectDB from "@/lib/mongodb";
import SocialIntegration from "@/models/SocialIntegration";

export class TikTokPublisher extends PlaceholderPublisher {
  readonly target = "tiktok" as const;
  readonly displayNameAr = "تيك توك";
  readonly displayNameEn = "TikTok";

  override async isReady(): Promise<boolean> {
    await connectDB();
    const row = await SocialIntegration.findOne({ provider: "tiktok" }).lean();
    return row?.status === "connected";
  }

  override validate(ctx: PublishContext) {
    const base = super.validate(ctx);
    const blocking = [...base.blocking];
    blocking.push("tiktok_requires_video_flow");
    return { ok: false, warnings: [...base.warnings, "يتطلب TikTok مسار فيديو / Direct Post API."], blocking };
  }

  override async publish(): Promise<PublishAttemptResult> {
    return {
      target: "tiktok",
      success: false,
      errorMessage: "TikTok: استخدم مسار Content Posting API الرسمي (فيديو) — غير مفعّل في هذه المرحلة.",
    };
  }
}
