import mongoose from "mongoose";
import User from "@/models/User";
import AlumniOpportunity from "@/models/AlumniOpportunity";
import AlumniStory from "@/models/AlumniStory";

export const resolveFeedEngagementTargetOwner = async (
  kind: string,
  targetId: string
): Promise<mongoose.Types.ObjectId | null> => {
  const k = String(kind || "").trim().toLowerCase();
  let oid: mongoose.Types.ObjectId;
  try {
    oid = new mongoose.Types.ObjectId(targetId);
  } catch {
    return null;
  }

  if (k === "mentor") {
    return oid;
  }

  if (k === "opportunity") {
    const o = await AlumniOpportunity.findById(oid).select("createdByUserId").lean();
    const c = (o as { createdByUserId?: mongoose.Types.ObjectId } | null)?.createdByUserId;
    return c ? new mongoose.Types.ObjectId(String(c)) : null;
  }

  if (k === "story") {
    const s = await AlumniStory.findById(oid).select("relatedUserId createdById").lean();
    const plain = s as { relatedUserId?: unknown; createdById?: unknown } | null;
    const id = plain?.relatedUserId ?? plain?.createdById;
    return id ? new mongoose.Types.ObjectId(String(id)) : null;
  }

  if (k === "memory") {
    const u = await User.findOne({ "alumniProfile.memoryPosts._id": oid }).select("_id").lean();
    return u?._id ? new mongoose.Types.ObjectId(String(u._id)) : null;
  }

  return null;
};
