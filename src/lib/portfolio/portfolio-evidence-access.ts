import "server-only";

import mongoose from "mongoose";

import connectDB from "@/lib/mongodb";
import Achievement from "@/models/Achievement";
import User from "@/models/User";
import { publicPortfolioAchievementMatch, publicPortfolioTokensEqual } from "@/lib/public-portfolio";
import { parsePortfolioEvidenceRef } from "@/lib/portfolio/portfolio-evidence-ref";
import {
  parsePortfolioCoverEvidenceRef,
  resolvePublicAttachmentByIndex,
  resolveVirtualCoverEvidenceStreamSource,
} from "@/lib/portfolio/portfolio-evidence-policy";
import { openPortfolioEvidenceStream } from "@/lib/portfolio/portfolio-evidence-storage";

export type PortfolioEvidenceAccessResult =
  | {
      ok: true;
      stream: import("stream").Readable;
      contentType: string;
      contentLength?: number;
      fileName: string;
    }
  | { ok: false; error: "not_found" | "forbidden" };

const USER_TOKEN_SELECT = "+publicPortfolioToken publicPortfolioEnabled publicPortfolioSlug role accountType studentLifecycleStatus";

export const authorizePortfolioEvidenceAccess = async (input: {
  slug: string;
  token: string;
  ref: string;
}): Promise<PortfolioEvidenceAccessResult> => {
  const slug = String(input.slug || "").trim().toLowerCase();
  const token = String(input.token || "").trim();
  const parsedAttachmentRef = parsePortfolioEvidenceRef(input.ref);
  const parsedCoverRef = parsedAttachmentRef ? null : parsePortfolioCoverEvidenceRef(input.ref);
  if (!slug || !token || (!parsedAttachmentRef && !parsedCoverRef)) {
    return { ok: false, error: "not_found" };
  }

  await connectDB();

  const user = await User.findOne({ role: "student", publicPortfolioSlug: slug })
    .select(USER_TOKEN_SELECT)
    .lean();
  if (!user) return { ok: false, error: "not_found" };

  const storedToken =
    typeof (user as { publicPortfolioToken?: string }).publicPortfolioToken === "string"
      ? (user as { publicPortfolioToken: string }).publicPortfolioToken.trim()
      : "";
  if (!storedToken || !publicPortfolioTokensEqual(storedToken, token)) {
    return { ok: false, error: "forbidden" };
  }
  if ((user as { publicPortfolioEnabled?: boolean }).publicPortfolioEnabled === false) {
    return { ok: false, error: "forbidden" };
  }

  const achievementId = parsedAttachmentRef?.achievementId ?? parsedCoverRef?.achievementId;
  if (!achievementId) return { ok: false, error: "not_found" };

  const userId = (user as { _id: mongoose.Types.ObjectId })._id;
  const achievement = await Achievement.findOne({
    _id: new mongoose.Types.ObjectId(achievementId),
    ...publicPortfolioAchievementMatch(userId),
  })
    .select("attachments image userId status approved")
    .lean();

  if (!achievement) return { ok: false, error: "not_found" };

  if (parsedCoverRef) {
    const coverSource = resolveVirtualCoverEvidenceStreamSource({
      attachmentsRaw: (achievement as { attachments?: unknown }).attachments,
      coverImageUrl: (achievement as { image?: string }).image,
    });
    if (!coverSource) return { ok: false, error: "forbidden" };

    const opened = await openPortfolioEvidenceStream({
      url: coverSource.url,
      mimeType: coverSource.mimeType,
      name: coverSource.fileName,
    });
    return {
      ok: true,
      stream: opened.stream,
      contentType: opened.contentType,
      contentLength: opened.contentLength,
      fileName: opened.fileName,
    };
  }

  const attachment = resolvePublicAttachmentByIndex(
    (achievement as { attachments?: unknown }).attachments,
    parsedAttachmentRef!.attachmentIndex
  );
  if (!attachment) return { ok: false, error: "forbidden" };

  const opened = await openPortfolioEvidenceStream(attachment);
  return {
    ok: true,
    stream: opened.stream,
    contentType: opened.contentType,
    contentLength: opened.contentLength,
    fileName: opened.fileName,
  };
};
