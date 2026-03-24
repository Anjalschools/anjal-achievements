import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import SchoolYear from "@/models/SchoolYear";
import { getPlatformSettings } from "@/lib/platform-settings-service";

export const listSchoolYears = async () => {
  await connectDB();
  return SchoolYear.find({}).sort({ startDate: -1 }).lean();
};

export const getCurrentSchoolYearName = async (): Promise<string | null> => {
  await connectDB();
  const y = await SchoolYear.findOne({ isCurrent: true }).select("name").lean();
  return y ? String((y as { name?: string }).name || "") : null;
};

export const setYearAsCurrent = async (
  yearId: string,
  opts: { autoArchivePrevious?: boolean } = {}
): Promise<void> => {
  if (!mongoose.Types.ObjectId.isValid(yearId)) throw new Error("Invalid year id");
  await connectDB();
  const autoArchive =
    opts.autoArchivePrevious ??
    (await getPlatformSettings()).schoolYearPolicy.autoArchivePreviousWhenActivating === true;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await SchoolYear.updateMany(
        { _id: { $ne: new mongoose.Types.ObjectId(yearId) } },
        { $set: { isCurrent: false } },
        { session }
      );
      const target = await SchoolYear.findById(yearId).session(session);
      if (!target) throw new Error("Year not found");
      target.isCurrent = true;
      target.status = "active";
      await target.save({ session });
      if (autoArchive) {
        await SchoolYear.updateMany(
          {
            _id: { $ne: new mongoose.Types.ObjectId(yearId) },
            status: { $ne: "archived" },
          },
          { $set: { status: "archived", archivedAt: new Date(), isCurrent: false } },
          { session }
        );
      }
    });
  } finally {
    await session.endSession();
  }
};

export const archiveSchoolYear = async (yearId: string): Promise<void> => {
  if (!mongoose.Types.ObjectId.isValid(yearId)) throw new Error("Invalid year id");
  await connectDB();
  await SchoolYear.updateOne(
    { _id: new mongoose.Types.ObjectId(yearId) },
    { $set: { status: "archived", archivedAt: new Date(), isCurrent: false } }
  );
};
