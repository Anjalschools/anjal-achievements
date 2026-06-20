import {
  BSON_QUERY_SAFE_LIMIT_BYTES,
  measureSerializedBytes,
} from "@/lib/school-intelligence/school-intelligence-bson-safety";

export type SchoolIntelligenceBsonComponent =
  | "filter"
  | "projection"
  | "options"
  | "populate"
  | "pipeline";

export type SchoolIntelligenceSerializationBreakdown = {
  filter: number;
  projection: number;
  options: number;
  populate: number;
  pipeline: number;
  total: number;
};

export type SchoolIntelligencePreSerializeSnapshot = {
  filter?: string;
  projection?: string;
  options?: string;
};

export type SchoolIntelligenceBsonSerializationTrace = {
  queryName: string;
  collection: string;
  filterBytes: number;
  projectionBytes: number;
  optionsBytes: number;
  populateBytes: number;
  pipelineBytes: number;
  serializationBreakdown: SchoolIntelligenceSerializationBreakdown;
  offendingComponent?: SchoolIntelligenceBsonComponent;
  preSerializeSnapshot: SchoolIntelligencePreSerializeSnapshot;
};

const PREVIEW_MAX_BYTES = 2048;

export const truncatePreview = (value: unknown, maxBytes = PREVIEW_MAX_BYTES): string | undefined => {
  if (value == null) return undefined;
  let serialized: string;
  try {
    serialized = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    serialized = String(value);
  }
  const bytes = Buffer.byteLength(serialized, "utf8");
  if (bytes <= maxBytes) return serialized;
  const truncated = Buffer.from(serialized, "utf8").subarray(0, maxBytes - 15).toString("utf8");
  return `${truncated}… [truncated]`;
};

export const normalizeProjectionForTrace = (
  projection: string | Record<string, unknown> | undefined
): unknown => {
  if (!projection) return {};
  if (typeof projection === "string") {
    return projection.split(/\s+/).filter(Boolean).reduce<Record<string, number>>((acc, field) => {
      acc[field] = 1;
      return acc;
    }, {});
  }
  return projection;
};

export const buildSerializationBreakdown = (input: {
  filter?: unknown;
  projection?: string | Record<string, unknown>;
  options?: unknown;
  populate?: unknown;
  pipeline?: unknown[];
}): SchoolIntelligenceSerializationBreakdown => {
  const filter = measureSerializedBytes(input.filter ?? {});
  const projection = measureSerializedBytes(normalizeProjectionForTrace(input.projection));
  const options = measureSerializedBytes(input.options ?? {});
  const populate = measureSerializedBytes(input.populate ?? {});
  const pipeline = measureSerializedBytes(input.pipeline ?? []);
  return {
    filter,
    projection,
    options,
    populate,
    pipeline,
    total: filter + projection + options + populate + pipeline,
  };
};

export const resolveOffendingComponent = (
  breakdown: SchoolIntelligenceSerializationBreakdown,
  limitBytes: number = BSON_QUERY_SAFE_LIMIT_BYTES
): SchoolIntelligenceBsonComponent | undefined => {
  const ranked: Array<[SchoolIntelligenceBsonComponent, number]> = [
    ["filter", breakdown.filter],
    ["projection", breakdown.projection],
    ["options", breakdown.options],
    ["populate", breakdown.populate],
    ["pipeline", breakdown.pipeline],
  ];
  const sorted = ranked.sort((a, b) => b[1] - a[1]);
  if (sorted[0]?.[1] === 0) return undefined;
  if (breakdown.total > limitBytes) {
    return sorted[0]?.[0];
  }
  return sorted[0]?.[0];
};

export const buildBsonSerializationTrace = (input: {
  queryName: string;
  collection: string;
  filter?: unknown;
  projection?: string | Record<string, unknown>;
  options?: unknown;
  populate?: unknown;
  pipeline?: unknown[];
  limitBytes?: number;
}): SchoolIntelligenceBsonSerializationTrace => {
  const serializationBreakdown = buildSerializationBreakdown(input);
  const limitBytes = input.limitBytes ?? BSON_QUERY_SAFE_LIMIT_BYTES;

  return {
    queryName: input.queryName,
    collection: input.collection,
    filterBytes: serializationBreakdown.filter,
    projectionBytes: serializationBreakdown.projection,
    optionsBytes: serializationBreakdown.options,
    populateBytes: serializationBreakdown.populate,
    pipelineBytes: serializationBreakdown.pipeline,
    serializationBreakdown,
    offendingComponent: resolveOffendingComponent(serializationBreakdown, limitBytes),
    preSerializeSnapshot: {
      filter: truncatePreview(input.filter ?? {}),
      projection: truncatePreview(normalizeProjectionForTrace(input.projection)),
      options: truncatePreview(input.options ?? {}),
    },
  };
};

export const pickLatestSerializationTrace = (
  traces: SchoolIntelligenceBsonSerializationTrace[] | undefined,
  queryName?: string
): SchoolIntelligenceBsonSerializationTrace | undefined => {
  if (!traces?.length) return undefined;
  if (queryName) {
    const matches = traces.filter((trace) => trace.queryName === queryName);
    if (matches.length > 0) return matches[matches.length - 1];
  }
  return traces[traces.length - 1];
};
