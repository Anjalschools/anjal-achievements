import mongoose from "mongoose";
import AlumniConsent from "@/models/AlumniConsent";

export type ConsentFlags = {
  campaignsEmail: boolean;
  systemNotifications: boolean;
  mentorshipNotifications: boolean;
  analyticsParticipation: boolean;
};

const defaults: ConsentFlags = {
  campaignsEmail: true,
  systemNotifications: true,
  mentorshipNotifications: true,
  analyticsParticipation: true,
};

export const getAlumniConsent = async (userId: mongoose.Types.ObjectId): Promise<ConsentFlags> => {
  const row = await AlumniConsent.findOne({ userId }).lean();
  if (!row) return defaults;
  const r = row as any;
  return {
    campaignsEmail: r.campaignsEmail !== false,
    systemNotifications: r.systemNotifications !== false,
    mentorshipNotifications: r.mentorshipNotifications !== false,
    analyticsParticipation: r.analyticsParticipation !== false,
  };
};

export const canSendCampaignEmail = async (userId: mongoose.Types.ObjectId): Promise<boolean> => {
  const c = await getAlumniConsent(userId);
  return c.campaignsEmail;
};

export const canSendSystemNotification = async (userId: mongoose.Types.ObjectId): Promise<boolean> => {
  const c = await getAlumniConsent(userId);
  return c.systemNotifications;
};

export const canSendMentorshipNotification = async (userId: mongoose.Types.ObjectId): Promise<boolean> => {
  const c = await getAlumniConsent(userId);
  return c.systemNotifications && c.mentorshipNotifications;
};
