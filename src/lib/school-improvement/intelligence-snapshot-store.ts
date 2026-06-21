import "server-only";
import connectDB from "@/lib/mongodb";
import IntelligenceSectionSnapshot, {
  type IntelligenceServiceDomain,
  type IntelligenceSnapshotKind,
} from "@/models/IntelligenceSectionSnapshot";
import {
  resolveSnapshotSaveTarget,
} from "@/lib/school-intelligence/school-intelligence-snapshot-payload-trace";
import { guardSnapshotPayloadBeforeSave } from "@/lib/school-intelligence/school-intelligence-snapshot-payload-guard";
import { SCHOOL_INTEL_PAYLOAD_SNAPSHOT_KEY } from "@/lib/school-intelligence/school-intelligence-boot";

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
  const resolvedKey = snapshotKey(input.kind, input.key);
  const saveTarget = resolveSnapshotSaveTarget(input.kind, input.key);

  guardSnapshotPayloadBeforeSave(input.payload, saveTarget);

  await connectDB();
  if (isSchoolIntelligenceSnapshotKey(input.key)) {
    console.info("[SchoolIntelligence Snapshot Save]", {
      logicalKey: input.key,
      resolvedKey,
      kind: input.kind,
      domain: input.domain,
      saveTarget,
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

export const saveQuerySnapshot = async (input: {
  key: string;
  domain: IntelligenceServiceDomain;
  payload: unknown;
}) =>
  saveIntelligenceSnapshot({
    key: input.key,
    domain: input.domain,
    kind: "query",
    payload: input.payload,
  });

export const saveSchoolIntelligenceSnapshot = async (input: {
  payload: unknown;
  domain?: IntelligenceServiceDomain;
}) =>
  saveIntelligenceSnapshot({
    key: SCHOOL_INTEL_PAYLOAD_SNAPSHOT_KEY,
    domain: input.domain ?? "school_improvement",
    kind: "full_payload",
    payload: input.payload,
  });

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
