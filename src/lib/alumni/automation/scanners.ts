import User from "@/models/User";
import { enqueueAutomationJob } from "./lifecycle-engine";

const MS_DAY = 86_400_000;

/** Alumni with no login for `inactiveDays` → single reactivation nudge (dedup via correlationId). */
export const enqueueInactiveAlumniJobs = async (inactiveDays = 120): Promise<number> => {
  const cutoff = new Date(Date.now() - inactiveDays * MS_DAY);
  const rows = await User.find({
    accountType: "alumni",
    $or: [{ lastLoginAt: { $exists: false } }, { lastLoginAt: null }, { lastLoginAt: { $lt: cutoff } }],
  })
    .select("_id")
    .limit(60)
    .lean();

  let n = 0;
  for (const row of rows) {
    const uid = row._id.toString();
    const r = await enqueueAutomationJob({
      type: "alumni.inactive",
      payload: { userId: uid },
      correlationId: `inactive-${uid}-${Math.floor(Date.now() / (MS_DAY * 30))}`,
    });
    if (r.created) n += 1;
  }
  return n;
};

const profileCompleteness = (ap: Record<string, unknown>): number => {
  let pts = 0;
  const fields = ["universityName", "major", "industry", "bio", "currentCompany", "linkedinUrl"];
  for (const f of fields) {
    const v = ap[f];
    if (typeof v === "string" && v.trim().length > 2) pts += 15;
  }
  return Math.min(100, pts);
};

/** Profiles below threshold → reminder jobs */
export const enqueueIncompleteProfileJobs = async (threshold = 45): Promise<number> => {
  const rows = await User.find({ accountType: "alumni" })
    .select("alumniProfile")
    .limit(120)
    .lean();

  let n = 0;
  for (const row of rows) {
    const ap = (row as any).alumniProfile || {};
    const c = profileCompleteness(ap as Record<string, unknown>);
    if (c >= threshold) continue;
    const uid = row._id.toString();
    const r = await enqueueAutomationJob({
      type: "profile.incomplete",
      payload: { userId: uid, completeness: c },
      correlationId: `profile-${uid}-${threshold}`,
    });
    if (r.created) n += 1;
  }
  return n;
};
