import "server-only";
import { recordSchoolIntelligenceSnapshotPayloadTrace } from "@/lib/school-intelligence/school-intelligence-section-tracer";
import {
  analyzeSnapshotPayload,
  SchoolIntelligenceSnapshotPayloadTooLargeError,
  SNAPSHOT_PAYLOAD_LIMIT_BYTES,
  SNAPSHOT_PAYLOAD_WARN_BYTES,
  type SchoolIntelligenceSnapshotPayloadTrace,
} from "@/lib/school-intelligence/school-intelligence-snapshot-payload-trace";

export const guardSnapshotPayloadBeforeSave = (
  payload: unknown,
  saveTarget: string
): SchoolIntelligenceSnapshotPayloadTrace => {
  const trace = analyzeSnapshotPayload(payload, saveTarget);
  recordSchoolIntelligenceSnapshotPayloadTrace(trace);

  console.info("[SnapshotPayloadTrace]", {
    saveTarget: trace.saveTarget,
    payloadBytes: trace.payloadBytes,
    jsonBytes: trace.jsonBytes,
    topLevelKeys: trace.topLevelKeys,
    largestTopLevelField: trace.largestTopLevelField,
    largestFieldBytes: trace.largestFieldBytes,
    fieldSizes: trace.fieldSizes,
  });

  if (trace.payloadBytes > SNAPSHOT_PAYLOAD_WARN_BYTES) {
    console.warn("[SnapshotPayloadTrace] payload exceeds warning threshold", {
      saveTarget: trace.saveTarget,
      payloadBytes: trace.payloadBytes,
      warnBytes: SNAPSHOT_PAYLOAD_WARN_BYTES,
      largestTopLevelField: trace.largestTopLevelField,
      largestFieldBytes: trace.largestFieldBytes,
    });
  }

  if (trace.payloadBytes > SNAPSHOT_PAYLOAD_LIMIT_BYTES) {
    throw new SchoolIntelligenceSnapshotPayloadTooLargeError(trace);
  }

  return trace;
};
