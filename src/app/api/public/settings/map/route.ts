import { NextResponse } from "next/server";
import { getPlatformSettings } from "@/lib/platform-settings-service";
import { normalizeMapEmbedUrl } from "@/lib/platform-settings-validation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const settings = await getPlatformSettings();
    const branding = (settings.branding || {}) as Record<string, unknown>;
    const mapEmbedUrl = normalizeMapEmbedUrl(String(branding.mapEmbedUrl || ""));
    const mapTitleAr = String(branding.mapTitleAr || branding.mapTitle || "").trim();
    const mapTitleEn = String(branding.mapTitleEn || branding.mapTitle || "").trim();
    const mapLocationLabelAr = String(branding.mapLocationLabelAr || branding.contactAddressAr || "").trim();
    const mapLocationLabelEn = String(branding.mapLocationLabelEn || branding.contactAddressEn || "").trim();
    const contactEmailPrimary = String(branding.contactEmailPrimary || "").trim();
    const contactEmailSecondary = String(branding.contactEmailSecondary || "").trim();
    const contactPhonePrimary = String(branding.contactPhonePrimary || "").trim();
    const contactPhoneSecondary = String(branding.contactPhoneSecondary || "").trim();
    const contactAddressAr = String(branding.contactAddressAr || "").trim();
    const contactAddressEn = String(branding.contactAddressEn || "").trim();
    const contactInfoTitleAr = String(branding.contactInfoTitleAr || "").trim();
    const contactInfoTitleEn = String(branding.contactInfoTitleEn || "").trim();
    const contactPageIntroAr = String(branding.contactPageIntroAr || "").trim();
    const contactPageIntroEn = String(branding.contactPageIntroEn || "").trim();
    const latitudeRaw = branding.latitude;
    const longitudeRaw = branding.longitude;
    const latitude =
      typeof latitudeRaw === "number" && Number.isFinite(latitudeRaw) ? latitudeRaw : null;
    const longitude =
      typeof longitudeRaw === "number" && Number.isFinite(longitudeRaw) ? longitudeRaw : null;

    return NextResponse.json({
      ok: true,
      data: {
        mapEmbedUrl: mapEmbedUrl || null,
        mapTitleAr: mapTitleAr || null,
        mapTitleEn: mapTitleEn || null,
        mapLocationLabelAr: mapLocationLabelAr || null,
        mapLocationLabelEn: mapLocationLabelEn || null,
        contactEmailPrimary: contactEmailPrimary || null,
        contactEmailSecondary: contactEmailSecondary || null,
        contactPhonePrimary: contactPhonePrimary || null,
        contactPhoneSecondary: contactPhoneSecondary || null,
        contactAddressAr: contactAddressAr || null,
        contactAddressEn: contactAddressEn || null,
        contactInfoTitleAr: contactInfoTitleAr || null,
        contactInfoTitleEn: contactInfoTitleEn || null,
        contactPageIntroAr: contactPageIntroAr || null,
        contactPageIntroEn: contactPageIntroEn || null,
        latitude,
        longitude,
      },
    });
  } catch (e) {
    console.error("[GET /api/public/settings/map]", e);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

