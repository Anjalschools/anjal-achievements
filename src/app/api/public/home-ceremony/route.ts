import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import SiteSettings from "@/models/SiteSettings";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { buildHomePageContentFromSource } from "@/lib/home-page-content";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await connectDB();

    let settings = await SiteSettings.findOne({ key: "main" }).lean();
    if (!settings) {
      settings = await SiteSettings.create({ key: "main" });
    }

    return NextResponse.json({
      ok: true,
      data: buildHomePageContentFromSource(settings),
    });
  } catch (e) {
    return jsonInternalServerError(e);
  }
}
