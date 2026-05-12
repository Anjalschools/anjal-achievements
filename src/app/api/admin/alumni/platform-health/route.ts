import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import AlumniAutomationJob from "@/models/AlumniAutomationJob";
import AlumniCampaignRecipient from "@/models/AlumniCampaignRecipient";
import { requireAlumniAdministrationActor } from "@/lib/admin-user-management-auth";
import { checkMongoHealth } from "@/lib/alumni/monitoring/api-health";
import { getDeliveryCounters } from "@/lib/alumni/monitoring/delivery-monitor";
import { getMetricsSummary } from "@/lib/alumni/monitoring/metrics";
import { getQueueHealthSnapshot } from "@/lib/queue/queue-metrics";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAlumniAdministrationActor();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const [mongo, pending, failed, recentFailures] = await Promise.all([
      checkMongoHealth(),
      AlumniAutomationJob.countDocuments({ status: "pending" }),
      AlumniAutomationJob.countDocuments({ status: "failed" }),
      AlumniAutomationJob.find({ status: "failed" })
        .sort({ updatedAt: -1 })
        .limit(12)
        .select("type errorMessage retryCount updatedAt")
        .lean(),
    ]);

    const recipientFailed = await AlumniCampaignRecipient.countDocuments({ status: "failed" });

    return NextResponse.json({
      ok: true,
      data: {
        mongo,
        automationJobs: { pending, failed },
        campaignRecipientsFailed: recipientFailed,
        failedJobSamples: recentFailures.map((j: any) => ({
          type: j.type,
          error: j.errorMessage?.slice(0, 200),
          retries: j.retryCount,
          at: j.updatedAt ? new Date(j.updatedAt).toISOString() : null,
        })),
        delivery: getDeliveryCounters(),
        metrics: getMetricsSummary(),
        queue: getQueueHealthSnapshot(),
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/alumni/platform-health]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
