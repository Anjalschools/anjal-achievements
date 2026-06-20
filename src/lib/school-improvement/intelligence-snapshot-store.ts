import "server-only";
import connectDB from "@/lib/mongodb";
import IntelligenceSectionSnapshot, {
  type IntelligenceServiceDomain,
  type IntelligenceSnapshotKind,
} from "@/models/IntelligenceSectionSnapshot";

const snapshotKey = (kind: IntelligenceSnapshotKind, key: string) => `${kind}:${key}`;

const isSchoolIntelligenceSnapshotKey = (logicalKey: string) =>
  logicalKey === "school_intelligence_payload" ||
  logicalKey === "student_intelligence_facet" ||
  logicalKey === "student_intelligence_school_graph";

export const saveIntelligenceSnapshot = async (input: {
  key: string;
  domain: IntelligenceServiceDomain;
  kind: IntelligenceSnapshotKind;
  payload: unknown;
}) => {
  await connectDB();
  const resolvedKey = snapshotKey(input.kind, input.key);
  if (isSchoolIntelligenceSnapshotKey(input.key)) {
    console.info("[SchoolIntelligence Snapshot Save]", {
      logicalKey: input.key,
      resolvedKey,
      kind: input.kind,
      domain: input.domain,
    });
  }
  await IntelligenceSectionSnapshot.findOneAndUpdate(
    { key: resolvedKey },
    {
      key: resolvedKey,
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
  const resolvedKey = snapshotKey(kind, key);
  if (isSchoolIntelligenceSnapshotKey(key)) {
    console.info("[SchoolIntelligence Snapshot Load]", {
      logicalKey: key,
      resolvedKey,
      kind,
    });
  }
  const row = await IntelligenceSectionSnapshot.findOne({ key: resolvedKey })
    .select("payload capturedAt")
    .lean();
  if (!row?.payload) {
    if (isSchoolIntelligenceSnapshotKey(key)) {
      console.warn("[SchoolIntelligence Snapshot Miss]", { logicalKey: key, resolvedKey, kind });
    }
    return null;
  }
  if (isSchoolIntelligenceSnapshotKey(key)) {
    console.info("[SchoolIntelligence Snapshot Hit]", {
      logicalKey: key,
      resolvedKey,
      kind,
      capturedAt: row.capturedAt,
    });
  }
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
