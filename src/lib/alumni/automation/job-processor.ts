import mongoose from "mongoose";
import AlumniAutomationJob from "@/models/AlumniAutomationJob";
import AlumniCampaign from "@/models/AlumniCampaign";
import AlumniCampaignRecipient from "@/models/AlumniCampaignRecipient";
import { createStudentNotification } from "@/lib/student-notifications";
import { sendSmtpMail } from "@/lib/mailer";
import { recordDeliveryFailure, recordDeliverySuccess } from "@/lib/alumni/monitoring/delivery-monitor";
import { recordJobProcessed } from "@/lib/alumni/monitoring/metrics";
import {
  canSendCampaignEmail,
  canSendMentorshipNotification,
  canSendSystemNotification,
} from "@/lib/alumni/consent";

const MAX_RETRIES = 3;

const appBaseUrl = (): string => {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  return "";
};

export type ProcessBatchResult = {
  processed: number;
  failed: number;
  skipped: number;
};

const notifySystem = async (
  userId: mongoose.Types.ObjectId,
  input: Parameters<typeof createStudentNotification>[0]
): Promise<void> => {
  if (!(await canSendSystemNotification(userId))) return;
  await createStudentNotification(input);
};

const notifyMentorship = async (
  userId: mongoose.Types.ObjectId,
  input: Parameters<typeof createStudentNotification>[0]
): Promise<void> => {
  if (!(await canSendMentorshipNotification(userId))) return;
  await createStudentNotification(input);
};

const appendTrackingPixel = (html: string, trackingToken: string): string => {
  const base = appBaseUrl();
  if (!base || !trackingToken) return html;
  const pixel = `<img src="${base}/api/public/campaign-track?t=${encodeURIComponent(trackingToken)}" alt="" width="1" height="1" style="display:none" />`;
  if (html.includes("</body>")) return html.replace("</body>", `${pixel}</body>`);
  return `${html}${pixel}`;
};

export const processAutomationJobsBatch = async (limit = 25): Promise<ProcessBatchResult> => {
  const now = new Date();
  let processed = 0;
  let failed = 0;
  let skipped = 0;

  const jobs = await AlumniAutomationJob.find({
    status: "pending",
    scheduledFor: { $lte: now },
  })
    .sort({ scheduledFor: 1 })
    .limit(limit)
    .lean();

  for (const job of jobs) {
    const lock = await AlumniAutomationJob.findOneAndUpdate(
      { _id: job._id, status: "pending" },
      { $set: { status: "processing" } },
      { new: true }
    );
    if (!lock) {
      skipped += 1;
      continue;
    }

    try {
      await handleJob(lock as Parameters<typeof handleJob>[0]);
      await AlumniAutomationJob.updateOne(
        { _id: job._id },
        { $set: { status: "completed", processedAt: new Date(), errorMessage: undefined } }
      );
      processed += 1;
      recordJobProcessed(String(job.type), "ok");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      const retries = ((lock as { retryCount?: number }).retryCount || 0) + 1;
      if (retries >= MAX_RETRIES) {
        await AlumniAutomationJob.updateOne(
          { _id: job._id },
          {
            $set: {
              status: "failed",
              processedAt: new Date(),
              errorMessage: msg.slice(0, 2000),
              retryCount: retries,
            },
          }
        );
        failed += 1;
        recordJobProcessed(String(job.type), "failed");
        recordDeliveryFailure("automation_job", job.type);
      } else {
        await AlumniAutomationJob.updateOne(
          { _id: job._id },
          {
            $set: {
              status: "pending",
              retryCount: retries,
              scheduledFor: new Date(Date.now() + retries * 60_000),
              errorMessage: msg.slice(0, 500),
            },
          }
        );
        skipped += 1;
      }
    }
  }

  return { processed, failed, skipped };
};

const handleJob = async (job: {
  _id: unknown;
  type: string;
  payload: Record<string, unknown>;
}): Promise<void> => {
  const p = job.payload || {};

  switch (job.type) {
    case "alumni.welcome": {
      const userId = p.userId;
      if (!mongoose.isValidObjectId(userId)) return;
      const uid = new mongoose.Types.ObjectId(String(userId));
      await notifySystem(uid, {
        userId: uid,
        type: "system",
        title: "مرحبًا بك في مجتمع خريجي الأنجال",
        message: "تم تفعيل حسابك كخريج. أكمل ملفك للاستفادة من الإرشاد والفرص والفعاليات.",
        metadata: { alumniAutomation: true, jobType: job.type },
      });
      return;
    }
    case "mentorship.pending": {
      const mentorId = p.mentorId;
      if (!mongoose.isValidObjectId(mentorId)) return;
      const mid = new mongoose.Types.ObjectId(String(mentorId));
      await notifyMentorship(mid, {
        userId: mid,
        type: "system",
        title: "طلب إرشاد جديد",
        message: "لديك طلب إرشاد في انتظار الرد من صندوق الإرشاد.",
        metadata: { alumniAutomation: true, jobType: job.type },
      });
      return;
    }
    case "mentorship.reminder": {
      const userId = p.userId;
      if (!mongoose.isValidObjectId(userId)) return;
      const uid = new mongoose.Types.ObjectId(String(userId));
      await notifyMentorship(uid, {
        userId: uid,
        type: "system",
        title: "تذكير: طلب إرشاد معلّق",
        message: "يرجى مراجعة طلبات الإرشاد المعلّقة في لوحة الخريج.",
        metadata: { alumniAutomation: true, jobType: job.type },
      });
      return;
    }
    case "event.invitation":
    case "event.upcoming": {
      const userId = p.userId;
      const title = typeof p.title === "string" ? p.title : "فعالية";
      if (!mongoose.isValidObjectId(userId)) return;
      const uid = new mongoose.Types.ObjectId(String(userId));
      await notifySystem(uid, {
        userId: uid,
        type: "system",
        title: "دعوة فعالية",
        message: `فعالية قادمة: ${title}. راجع صفحة فعاليات الخريجين للتفاصيل.`,
        metadata: { alumniAutomation: true, jobType: job.type, eventId: p.eventId },
      });
      return;
    }
    case "profile.incomplete": {
      const userId = p.userId;
      if (!mongoose.isValidObjectId(userId)) return;
      const uid = new mongoose.Types.ObjectId(String(userId));
      await notifySystem(uid, {
        userId: uid,
        type: "system",
        title: "أكمل ملف الخريج",
        message: "بعض الحقول الأساسية غير مكتملة — سيساعد ذلك على التوصيات والفرص.",
        metadata: { alumniAutomation: true, jobType: job.type },
      });
      return;
    }
    case "alumni.inactive": {
      const userId = p.userId;
      if (!mongoose.isValidObjectId(userId)) return;
      const uid = new mongoose.Types.ObjectId(String(userId));
      await notifySystem(uid, {
        userId: uid,
        type: "system",
        title: "افتقدناك في المنصة",
        message: "عد إلى مجتمع خريجي الأنجال للاطلاع على الفعاليات والفرص الجديدة.",
        metadata: { alumniAutomation: true, jobType: job.type },
      });
      return;
    }
    case "campaign.launch": {
      return;
    }
    case "campaign.email": {
      const recipientId = p.recipientId;
      const campaignId = p.campaignId;
      if (!mongoose.isValidObjectId(recipientId) || !mongoose.isValidObjectId(campaignId)) return;

      const recipient = await AlumniCampaignRecipient.findById(recipientId).lean();
      const campaign = await AlumniCampaign.findById(campaignId).lean();
      if (!recipient || !campaign) return;

      const rid = recipient.userId as mongoose.Types.ObjectId;
      if (!(await canSendCampaignEmail(rid))) {
        await AlumniCampaignRecipient.updateOne(
          { _id: recipient._id },
          { $set: { status: "skipped", errorMessage: "consent_campaigns_email" } }
        );
        return;
      }

      const html = appendTrackingPixel(campaign.bodyHtml, recipient.trackingToken);
      const mail = await sendSmtpMail({
        to: recipient.emailSnapshot,
        subject: campaign.subject,
        text: campaign.bodyText,
        html,
      });

      if (mail.ok) {
        await AlumniCampaignRecipient.updateOne(
          { _id: recipient._id },
          { $set: { status: "sent", sentAt: new Date() } }
        );
        await AlumniCampaign.updateOne({ _id: campaign._id }, { $inc: { statsDelivered: 1 } });
        recordDeliverySuccess("campaign_email");
      } else {
        await AlumniCampaignRecipient.updateOne(
          { _id: recipient._id },
          { $set: { status: "failed", errorMessage: "smtp_unavailable" } }
        );
        await AlumniCampaign.updateOne({ _id: campaign._id }, { $inc: { statsFailed: 1 } });
        recordDeliveryFailure("campaign_email", "smtp");
        throw new Error("SMTP send failed");
      }
      return;
    }
    default:
      return;
  }
};
