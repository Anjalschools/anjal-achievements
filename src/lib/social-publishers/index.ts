import type { PublishTarget } from "@/models/NewsPost";
import type { SocialPublisher } from "@/lib/social-publishers/types";
import { InstagramPublisher } from "@/lib/social-publishers/instagram";
import { XPublisher } from "@/lib/social-publishers/x";
import { TikTokPublisher } from "@/lib/social-publishers/tiktok";
import { SnapchatPublisher } from "@/lib/social-publishers/snapchat";

const publishers: SocialPublisher[] = [
  new InstagramPublisher(),
  new XPublisher(),
  new TikTokPublisher(),
  new SnapchatPublisher(),
];

const byTarget = new Map<PublishTarget, SocialPublisher>(
  publishers.map((p) => [p.target, p])
);

export const getSocialPublisher = (t: PublishTarget): SocialPublisher | undefined => byTarget.get(t);

export const listSocialPublishers = (): SocialPublisher[] => [...publishers];
