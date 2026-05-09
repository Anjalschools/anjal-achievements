import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import AlumniCampaignRecipient from "@/models/AlumniCampaignRecipient";
import AlumniCampaign from "@/models/AlumniCampaign";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

/** Tracking pixel / redirect-free beacon for opens & clicks (extend with redirect URL for links). */
export async function GET(request: NextRequest) {
  const t = request.nextUrl.searchParams.get("t");
  const action = request.nextUrl.searchParams.get("a") || "open";

  if (!t || t.length < 8) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    await connectDB();
    const rec = await AlumniCampaignRecipient.findOne({ trackingToken: t }).select("campaignId openedAt clickedAt").lean();
    if (!rec?._id || !rec.campaignId) {
      return new NextResponse(null, { status: 204 });
    }

    const cid = rec.campaignId as mongoose.Types.ObjectId;

    if (action === "click") {
      if (!rec.clickedAt) {
        await AlumniCampaignRecipient.updateOne(
          { _id: rec._id },
          { $set: { clickedAt: new Date(), status: "clicked" } }
        );
        await AlumniCampaign.updateOne({ _id: cid }, { $inc: { statsClicked: 1 } });
      }
    } else if (!rec.openedAt) {
      await AlumniCampaignRecipient.updateOne(
        { _id: rec._id },
        { $set: { openedAt: new Date(), status: "opened" } }
      );
      await AlumniCampaign.updateOne({ _id: cid }, { $inc: { statsOpened: 1 } });
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
