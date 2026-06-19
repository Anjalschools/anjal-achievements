import "server-only";
import connectDB from "@/lib/mongodb";
import IntelligenceSectionSnapshot, {
  type IntelligenceServiceDomain,
  type IntelligenceSnapshotKind,
} from "@/models/IntelligenceSectionSnapshot";

const snapshotKey = (kind: IntelligenceSnapshotKind, key: string) => `${kind}:${key}`;

export const saveIntelligenceSnapshot = async (input: {
  key: string;
  domain: IntelligenceServiceDomain;
  kind: IntelligenceSnapshotKind;
  payload: unknown;
}) => {
  await connectDB();
  await IntelligenceSectionSnapshot.findOneAndUpdate(
    { key: snapshotKey(input.kind, input.key) },
    {
      key: snapshotKey(input.kind, input.key),
      domain: input.domain,
      kind: input.kind,
      payload: input.payload,
      capturedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

export const loadIntelligenceSnapshot = async <T>(
  key: string,
  kind: IntelligenceSnapshotKind
): Promise<T | null> => {
  await connectDB();
  const row = await IntelligenceSectionSnapshot.findOne({ key: snapshotKey(kind, key) })
    .select("payload capturedAt")
    .lean();
  if (!row?.payload) return null;
  return row.payload as T;
};

export const clearIntelligenceSnapshot = async (key: string, kind: IntelligenceSnapshotKind) => {
  await connectDB();
  await IntelligenceSectionSnapshot.deleteOne({ key: snapshotKey(kind, key) });
};

export const clearStaleIntelligenceSnapshots = async (olderThanMs: number) => {
  await connectDB();
  const cutoff = new Date(Date.now() - olderThanMs);
  const result = await IntelligenceSectionSnapshot.deleteMany({ capturedAt: { $lt: cutoff } });
  return result.deletedCount || 0;
};

export const listIntelligenceSnapshots = async () => {
  await connectDB();
  return IntelligenceSectionSnapshot.find({})
    .sort({ capturedAt: -1 })
    .limit(100)
    .select("key domain kind capturedAt")
    .lean();
};
