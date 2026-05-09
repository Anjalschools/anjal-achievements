import mongoose from "mongoose";
import AlumniCampaign from "@/models/AlumniCampaign";
import AlumniCampaignRecipient from "@/models/AlumniCampaignRecipient";
import { enqueueAutomationJob } from "./lifecycle-engine";

/** Dispatches campaign sends into the automation queue (one job per email) — workers can be swapped for BullMQ/Cloud Tasks. */
export const queueCampaignEmailJobs = async (campaignId: string): Promise<{ jobs: number; recipients: number }> => {
  if (!mongoose.isValidObjectId(campaignId)) return { jobs: 0, recipients: 0 };

  const pending = await AlumniCampaignRecipient.find({
    campaignId: new mongoose.Types.ObjectId(campaignId),
    status: "pending",
  })
    .select("_id userId")
    .limit(2000)
    .lean();

  let jobs = 0;
  for (const r of pending) {
    const res = await enqueueAutomationJob({
      type: "campaign.email",
      payload: {
        campaignId,
        recipientId: r._id.toString(),
        userId: r.userId.toString(),
      },
      correlationId: `campaign-email-${campaignId}-${r._id.toString()}`,
    });
    if (res.created) jobs += 1;
  }

  await AlumniCampaign.updateOne(
    { _id: new mongoose.Types.ObjectId(campaignId) },
    { $set: { status: "sending" } }
  );

  return { jobs, recipients: pending.length };
};

/** Placeholder: map product “launch” to analytics-friendly automation signal */
export const emitCampaignLaunchSignal = async (campaignId: string) => {
  await enqueueAutomationJob({
    type: "campaign.launch",
    payload: { campaignId, ts: new Date().toISOString() },
    correlationId: `campaign-launch-${campaignId}`,
  });
};
