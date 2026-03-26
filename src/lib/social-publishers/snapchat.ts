import { PlaceholderPublisher } from "@/lib/social-publishers/base";
import type { PublishAttemptResult } from "@/lib/social-publishers/types";

/** Snapchat organic posting is limited; placeholder explains status. */
export class SnapchatPublisher extends PlaceholderPublisher {
  readonly target = "snapchat" as const;
  readonly displayNameAr = "سناب شات";
  readonly displayNameEn = "Snapchat";

  override async isReady(): Promise<boolean> {
    return false;
  }

  override async publish(): Promise<PublishAttemptResult> {
    return {
      target: "snapchat",
      success: false,
      errorMessage:
        "سناب شات: لا يوجد نشر عضوي مباشر عام في هذه المرحلة — التكامل يقتصر على حالة الربط والتجارب المستقبلية.",
    };
  }
}
