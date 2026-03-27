import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import SiteSettings from "@/models/SiteSettings";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import {
  buildHomePageContentFromSource,
  DEFAULT_HOME_PAGE_CONTENT,
  normalizeRecognitionItems,
} from "@/lib/home-page-content";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const normalizePayload = (body: unknown) => {
  const source = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  return {
    visionAr: String(source.visionAr || "").trim(),
    visionEn: String(source.visionEn || "").trim(),
    missionAr: String(source.missionAr || "").trim(),
    missionEn: String(source.missionEn || "").trim(),
    ceremonyTitleAr: String(source.ceremonyTitleAr || "").trim(),
    ceremonyTitleEn: String(source.ceremonyTitleEn || "").trim(),
    ceremonySubtitleAr: String(source.ceremonySubtitleAr || "").trim(),
    ceremonySubtitleEn: String(source.ceremonySubtitleEn || "").trim(),
    ceremonyDescriptionAr: String(source.ceremonyDescriptionAr || "").trim(),
    ceremonyDescriptionEn: String(source.ceremonyDescriptionEn || "").trim(),
    ceremonyInvitationIntroAr: String(source.ceremonyInvitationIntroAr || "").trim(),
    ceremonyInvitationIntroEn: String(source.ceremonyInvitationIntroEn || "").trim(),
    ceremonyInvitationDateAr: String(source.ceremonyInvitationDateAr || "").trim(),
    ceremonyInvitationDateEn: String(source.ceremonyInvitationDateEn || "").trim(),
    ceremonyInvitationVenueAr: String(source.ceremonyInvitationVenueAr || "").trim(),
    ceremonyInvitationVenueEn: String(source.ceremonyInvitationVenueEn || "").trim(),
    ceremonyInvitationProgramAr: String(source.ceremonyInvitationProgramAr || "").trim(),
    ceremonyInvitationProgramEn: String(source.ceremonyInvitationProgramEn || "").trim(),
    ceremonyRecognitionItemsAr: normalizeRecognitionItems(
      source.ceremonyRecognitionItemsAr as string[] | string | undefined
    ),
    ceremonyRecognitionItemsEn: normalizeRecognitionItems(
      source.ceremonyRecognitionItemsEn as string[] | string | undefined
    ),
    ceremonyInvitationAwardsAr: String(source.ceremonyInvitationAwardsAr || "").trim(),
    ceremonyInvitationAwardsEn: String(source.ceremonyInvitationAwardsEn || "").trim(),
    ceremonyInvitationClosingAr: String(source.ceremonyInvitationClosingAr || "").trim(),
    ceremonyInvitationClosingEn: String(source.ceremonyInvitationClosingEn || "").trim(),
  };
};

export async function GET() {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const settings = await SiteSettings.findOne({ key: "main" }).lean();

    return NextResponse.json({
      ok: true,
      data: buildHomePageContentFromSource(settings),
    });
  } catch (e) {
    return jsonInternalServerError(e);
  }
}

export async function PATCH(req: Request) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const body = await req.json();
    const payload = { ...DEFAULT_HOME_PAGE_CONTENT, ...normalizePayload(body) };
    const recognitionItemsAr =
      payload.ceremonyRecognitionItemsAr.length > 0
        ? payload.ceremonyRecognitionItemsAr
        : normalizeRecognitionItems(payload.ceremonyInvitationProgramAr);
    const recognitionItemsEn =
      payload.ceremonyRecognitionItemsEn.length > 0
        ? payload.ceremonyRecognitionItemsEn
        : normalizeRecognitionItems(payload.ceremonyInvitationProgramEn);

    const updated = await SiteSettings.findOneAndUpdate(
      { key: "main" },
      {
        $set: {
          homePageContent: {
            ...payload,
            ceremonyRecognitionItemsAr: recognitionItemsAr,
            ceremonyRecognitionItemsEn: recognitionItemsEn,
            ceremonyInvitationProgramAr:
              payload.ceremonyInvitationProgramAr || recognitionItemsAr.join("، "),
            ceremonyInvitationProgramEn:
              payload.ceremonyInvitationProgramEn || recognitionItemsEn.join(", "),
          },
          homeCeremonySection: {
            titleAr: payload.ceremonyTitleAr,
            titleEn: payload.ceremonyTitleEn,
            subtitleAr: payload.ceremonySubtitleAr,
            subtitleEn: payload.ceremonySubtitleEn,
            descriptionAr: payload.ceremonyDescriptionAr,
            descriptionEn: payload.ceremonyDescriptionEn,
            invitationTextAr: payload.ceremonyInvitationAwardsAr,
            invitationTextEn: payload.ceremonyInvitationAwardsEn,
          },
        },
      },
      { new: true, upsert: true }
    ).lean();

    return NextResponse.json({
      ok: true,
      data: buildHomePageContentFromSource(updated),
    });
  } catch (e) {
    return jsonInternalServerError(e);
  }
}
